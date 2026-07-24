package com.gotcherapp.api.print;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.util.Base64;
import java.util.HexFormat;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

/**
 * Print s14a-1 — the Lulu webhook's authentication and its 200-vs-500 posture.
 *
 * <p>Two properties matter here and both are security-shaped. The signature IS the authentication (Lulu sends
 * no JWT and the endpoint sits under the {@code /print/**} permitAll block), so an unsigned or tampered body
 * must never reach the status writer. And because Lulu <b>deactivates a webhook after 5 consecutive failed
 * deliveries</b>, anything merely unrecognised has to be acknowledged rather than thrown — an over-eager 500
 * would switch off our own failure detector.
 */
@ExtendWith(MockitoExtension.class)
class LuluWebhookServiceTest {

    private static final String SECRET = "lulu-test-secret";
    private static final String JOB_BODY =
        "{\"topic\":\"PRINT_JOB_STATUS_CHANGED\",\"data\":{\"id\":314931," +
        "\"status\":{\"name\":\"REJECTED\"},\"line_items\":[{\"status\":{\"name\":\"REJECTED\"," +
        "\"messages\":{\"printable_normalization\":{\"interior\":[\"bad pdf\"]}}}}]}}";

    @Mock PrintOrderStatusService statusService;

    private LuluWebhookService service(String secret) {
        return new LuluWebhookService(statusService, new LuluJobStatusMapper(), new ObjectMapper(), secret);
    }

    private static byte[] digest(String payload, String secret) throws Exception {
        Mac mac = Mac.getInstance("HmacSHA256");
        mac.init(new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
        return mac.doFinal(payload.getBytes(StandardCharsets.UTF_8));
    }

    private static String hexSig(String payload) throws Exception {
        return HexFormat.of().formatHex(digest(payload, SECRET));
    }

    @Test
    void validHexSignature_appliesTheJobUpdate() throws Exception {
        service(SECRET).handle(JOB_BODY, hexSig(JOB_BODY));

        ArgumentCaptor<LuluJobStatusMapper.JobUpdate> u =
            ArgumentCaptor.forClass(LuluJobStatusMapper.JobUpdate.class);
        verify(statusService).applyJobUpdate(u.capture());
        assertEquals(314931L, u.getValue().jobId());
        assertEquals(LuluJobStatusMapper.STATUS_FAILED, u.getValue().orderStatus());
    }

    /** Lulu's docs don't pin the digest encoding and our sandbox has never sent one, so base64 verifies too. */
    @Test
    void validBase64Signature_alsoVerifies() throws Exception {
        service(SECRET).handle(JOB_BODY, Base64.getEncoder().encodeToString(digest(JOB_BODY, SECRET)));

        verify(statusService).applyJobUpdate(any());
    }

    @Test
    void tamperedBody_isRejected_andNeverReachesTheStatusWriter() throws Exception {
        String signature = hexSig(JOB_BODY);
        String tampered = JOB_BODY.replace("314931", "999999");

        assertThrows(LuluWebhookService.SignatureException.class,
            () -> service(SECRET).handle(tampered, signature));
        verifyNoInteractions(statusService);
    }

    @Test
    void missingSignatureHeader_isRejected() {
        assertThrows(LuluWebhookService.SignatureException.class, () -> service(SECRET).handle(JOB_BODY, null));
        verifyNoInteractions(statusService);
    }

    /** With no secret we cannot tell Lulu from anyone else on the internet — refusing is the only safe default. */
    @Test
    void unconfiguredSecret_refusesEverything() {
        assertThrows(LuluWebhookService.SignatureException.class, () -> service("").handle(JOB_BODY, "anything"));
        verifyNoInteractions(statusService);
    }

    /** A dummy test delivery must not throw: five consecutive failures and Lulu turns the webhook off. */
    @Test
    void signedPayloadWithNoJobId_isAcknowledged_notThrown() throws Exception {
        String body = "{\"topic\":\"PRINT_JOB_STATUS_CHANGED\",\"data\":{\"hello\":\"world\"}}";

        service(SECRET).handle(body, hexSig(body));

        verifyNoInteractions(statusService);   // acknowledged (no exception), but nothing to apply
    }

    @Test
    void otherTopics_areIgnored() throws Exception {
        String body = "{\"topic\":\"SOMETHING_ELSE\",\"data\":{\"id\":1}}";

        service(SECRET).handle(body, hexSig(body));

        verifyNoInteractions(statusService);
    }
}
