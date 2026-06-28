// Circular baby avatar: shows the uploaded photo (cropped portrait, object-cover) or a soft gradient
// placeholder with the name's first initial. Used on the dashboard profile card and the edit modal.
export default function Avatar({ photoUrl, name, sex, size = 56, className = "" }) {
  const initial = (name || "").trim().charAt(0).toUpperCase() || "👶";
  // Gentle, sex-tinted gradient for the placeholder; neutral lavender when sex is unspecified.
  const gradient =
    sex === "female" ? "linear-gradient(135deg,#f5b6d6,#f0a0c4)"
    : sex === "male" ? "linear-gradient(135deg,#b6cdf5,#a0c4f0)"
    : "linear-gradient(135deg,#c9b6f5,#a0c4f0)";

  return (
    <div
      className={`rounded-full overflow-hidden flex-shrink-0 flex items-center justify-center text-white font-display font-bold ${className}`}
      style={{ width: size, height: size, background: photoUrl ? undefined : gradient, fontSize: size * 0.4 }}
    >
      {photoUrl ? (
        <img src={photoUrl} alt={name || "Baby"} className="w-full h-full object-cover" />
      ) : (
        <span>{initial}</span>
      )}
    </div>
  );
}
