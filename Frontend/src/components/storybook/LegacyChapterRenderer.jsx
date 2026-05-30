// Renders chapter body text with inline [PHOTO:...] markers.
// Used as a fallback for chapters that were generated before the layout editor.

export function ChapterPhoto({ url, label, orientation = 'landscape' }) {
  if (orientation === 'portrait') {
    return (
      <figure className="my-3 max-w-[50%]">
        <img src={url} alt={label || ''} className="w-full h-auto block rounded-lg shadow-sm" />
        {label && <figcaption className="text-center text-[11px] text-muted-foreground mt-1 leading-tight">{label}</figcaption>}
      </figure>
    );
  }
  return (
    <figure className="my-3">
      <div className="w-full aspect-[4/3] overflow-hidden rounded-lg shadow-sm">
        <img src={url} alt={label || ''} className="w-full h-full object-cover" />
      </div>
      {label && <figcaption className="text-center text-xs text-muted-foreground mt-1.5">{label}</figcaption>}
    </figure>
  );
}

export function parseBodySegments(body) {
  if (!body) return [];
  const parts = body.split(/(\[PHOTO:(?:journal|first_time):\d+\])/);
  return parts
    .map(part => {
      const match = part.match(/^\[PHOTO:(journal|first_time):(\d+)\]$/);
      if (match) return { type: 'photo', photoType: match[1], photoId: parseInt(match[2]) };
      const text = part.replace(/^\n+|\n+$/g, '');
      if (!text) return null;
      return { type: 'text', content: text };
    })
    .filter(Boolean);
}

export function lookupPhoto(photoType, photoId, photoOverrides, journalEntries, firsts) {
  const key = `${photoType}:${photoId}`;
  const url = photoOverrides?.[key]
    ?? (photoType === 'journal' ? journalEntries?.find(e => e.id === photoId)?.image_url : undefined)
    ?? (photoType === 'first_time' ? firsts?.find(f => f.id === photoId)?.imageUrl : undefined);
  const entry = photoType === 'journal' ? journalEntries?.find(e => e.id === photoId) : null;
  const ft = photoType === 'first_time' ? firsts?.find(f => f.id === photoId) : null;
  const label = entry?.title ?? ft?.label ?? null;
  const orientation = entry?.image_orientation ?? ft?.imageOrientation ?? 'landscape';
  return { url: url ?? null, label, orientation };
}

export function renderPublishedBody(body, photoOverrides, journalEntries, firsts, theme) {
  const fontClass = theme?.fontClass || 'font-serif';
  const segments = parseBodySegments(body);
  const elements = [];
  let firstPara = true;
  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    if (seg.type === 'photo') continue;
    const paragraphs = seg.content.split('\n\n').filter(p => p.trim());
    const nextSeg = segments[i + 1];
    const hasPairedPhoto = nextSeg?.type === 'photo';
    const mainParas = hasPairedPhoto ? paragraphs.slice(0, -1) : paragraphs;
    mainParas.forEach((para, j) => {
      const isFirst = firstPara; firstPara = false;
      elements.push(
        <p key={`p-${i}-${j}`} className={`${fontClass} text-[15px] leading-8 text-foreground/85 ${isFirst ? 'book-chapter-first' : 'mt-4'}`}>
          {para.trim()}
        </p>
      );
    });
    if (hasPairedPhoto && paragraphs.length > 0) {
      const lastPara = paragraphs[paragraphs.length - 1];
      const photo = segments[i + 1];
      const { url, label } = lookupPhoto(photo.photoType, photo.photoId, photoOverrides, journalEntries, firsts);
      const isFirst = firstPara; firstPara = false;
      if (url) {
        elements.push(
          <div key={`pair-${i}`} className="flex gap-4 mt-4 items-stretch">
            <p className={`${fontClass} text-[15px] leading-8 text-foreground/85 flex-1 min-w-0 ${isFirst ? 'book-chapter-first' : ''}`}>
              {lastPara.trim()}
            </p>
            <figure className="flex-shrink-0 w-[28%] flex flex-col">
              <img src={url} alt={label || ''} className="flex-1 w-full min-h-0 object-cover rounded-lg shadow-sm" />
              {label && <figcaption className="shrink-0 text-center text-xs text-muted-foreground mt-1 italic">{label}</figcaption>}
            </figure>
          </div>
        );
      } else {
        elements.push(
          <p key={`p-${i}-last`} className={`${fontClass} text-[15px] leading-8 text-foreground/85 ${isFirst ? 'book-chapter-first' : 'mt-4'}`}>
            {lastPara.trim()}
          </p>
        );
      }
      i++;
    }
  }
  return elements;
}

export function renderDraftBody(body, photoOverrides, journalEntries, firsts) {
  const segments = parseBodySegments(body);
  if (segments.every(s => s.type === 'text')) {
    return <p className="text-base leading-relaxed whitespace-pre-wrap">{body}</p>;
  }
  const elements = [];
  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    if (seg.type === 'photo') continue;
    const paragraphs = seg.content.split('\n\n').filter(p => p.trim());
    const nextSeg = segments[i + 1];
    const hasPairedPhoto = nextSeg?.type === 'photo';
    const mainParas = hasPairedPhoto ? paragraphs.slice(0, -1) : paragraphs;
    mainParas.forEach((para, j) => {
      elements.push(<p key={`p-${i}-${j}`} className="text-base leading-relaxed mt-3">{para.trim()}</p>);
    });
    if (hasPairedPhoto && paragraphs.length > 0) {
      const lastPara = paragraphs[paragraphs.length - 1];
      const photo = segments[i + 1];
      const { url, label } = lookupPhoto(photo.photoType, photo.photoId, photoOverrides, journalEntries, firsts);
      if (url) {
        elements.push(
          <div key={`pair-${i}`} className="flex gap-3 mt-3 items-stretch">
            <p className="text-base leading-relaxed flex-1 min-w-0">{lastPara.trim()}</p>
            <figure className="flex-shrink-0 w-[28%] flex flex-col">
              <img src={url} alt={label || ''} className="flex-1 w-full min-h-0 object-cover rounded-lg" />
              {label && <figcaption className="shrink-0 text-center text-[11px] text-muted-foreground mt-1">{label}</figcaption>}
            </figure>
          </div>
        );
      } else {
        elements.push(<p key={`p-${i}-last`} className="text-base leading-relaxed mt-3">{lastPara.trim()}</p>);
      }
      i++;
    }
  }
  return <div>{elements}</div>;
}
