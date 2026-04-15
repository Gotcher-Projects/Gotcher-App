export async function shareFirstTime({ label, occurredDate, babyName, imageUrl }) {
  const text = `${babyName}'s first ${label} — ${occurredDate}`;
  const shareData = { title: `${babyName}'s First Times`, text };
  if (imageUrl) shareData.url = imageUrl;

  if (navigator.share && navigator.canShare && navigator.canShare(shareData)) {
    await navigator.share(shareData);
  } else {
    await navigator.clipboard.writeText(`${text}${imageUrl ? '\n' + imageUrl : ''}`);
    return 'copied';
  }
}
