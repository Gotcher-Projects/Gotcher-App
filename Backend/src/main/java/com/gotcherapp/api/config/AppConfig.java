package com.gotcherapp.api.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.web.client.RestTemplate;

@Configuration
public class AppConfig {

    @Bean
    public RestTemplate restTemplate() {
        // Without explicit timeouts, SimpleClientHttpRequestFactory defaults to infinite connect/read
        // timeouts. A stalled Anthropic call (the "write this for me" assist, the only caller) would pin
        // a Tomcat worker forever; enough concurrent stalls exhaust the pool and take the whole API down.
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(10_000);
        factory.setReadTimeout(60_000);
        return new RestTemplate(factory);
    }
}
