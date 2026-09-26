// Original cartoon cats as inline SVG + their CSS state animations: six classics and
// six "meme-style" cats that riff on famous internet cat formats with original art
// (no meme images are bundled; users can upload their own).
// States (CSS classes on the wrapper): love | happy | idle | worried | shocked | faint.
// Only transform/opacity are animated; prefers-reduced-motion freezes everything.
// Every SVG also renders correctly without CSS (hidden parts use opacity="0"),
// which is what the toolbar-icon renderer relies on.
(function (root) {
  'use strict';
  const CL = (root.Callina = root.Callina || {});

  const LIST = [
    { id: 'loaf', name: 'Loaf', blurb: 'A bread-shaped cat. Blinks very, very slowly.' },
    { id: 'judge', name: 'Judge', blurb: 'Side-eyes your cart. Tail flicks in disapproval.' },
    { id: 'derp', name: 'Derp', blurb: 'Tongue out, head wobbling, zero thoughts.' },
    { id: 'screamer', name: 'Screamer', blurb: 'Tiny mouth. Until the price is big.' },
    { id: 'keys', name: 'Keyboard Paws', blurb: 'Busy typing. Probably ordering more treats.' },
    { id: 'void', name: 'Void', blurb: 'All black. Glowing eyes blink in the dark.' },
    { id: 'pop', name: 'Pop', group: 'meme', blurb: 'Mouth goes pop. Then pop again. Forever.' },
    { id: 'monday', name: 'Monday', group: 'meme', blurb: 'Hates Mondays, prices, and probably you.' },
    { id: 'vibe', name: 'Vibe', group: 'meme', blurb: 'Headphones on, head bobbing, zero worries.' },
    { id: 'sadthumbs', name: 'Sad Thumbs', group: 'meme', blurb: 'Crying, but supportive. “It’s fine.”' },
    { id: 'huh', name: 'Huh?', group: 'meme', blurb: 'Confused head tilt at every price tag.' },
    { id: 'banana', name: 'Banana', group: 'meme', blurb: 'A cat in a banana suit. It doesn’t know why either.' },
  ];
  for (const c of LIST) c.group = c.group || 'classic';

  const PINK = '#EF8A99';

  function catSvg(o) {
    const L = o.line;
    const F = o.feat || L; // colour for face features drawn on fur
    const sw = 'stroke-linecap="round" stroke-linejoin="round"';

    const eyesNormal = o.eyesNormal || `
      <g class="cc-eyes-normal">
        <ellipse cx="48" cy="49" rx="4.3" ry="5.4" fill="${o.eye || '#2A1C12'}"/>
        <ellipse cx="72" cy="49" rx="4.3" ry="5.4" fill="${o.eye || '#2A1C12'}"/>
        <circle cx="49.6" cy="47" r="1.5" fill="#fff"/><circle cx="73.6" cy="47" r="1.5" fill="#fff"/>
      </g>`;
    const mouthNormal = o.mouthNormal || `
      <g class="cc-mouth-normal"><path d="M60 61 Q57 66 53 64 M60 61 Q63 66 67 64" fill="none" stroke="${o.mouth || L}" stroke-width="2" ${sw}/></g>`;

    const tail = o.tail === false ? '' : `
      <g class="cc-tail">
        <path d="${o.tailPath || 'M80 106 Q106 108 104 86 Q103 74 94 78'}" fill="none" stroke="${L}" stroke-width="12" ${sw}/>
        <path d="${o.tailPath || 'M80 106 Q106 108 104 86 Q103 74 94 78'}" fill="none" stroke="${o.fur}" stroke-width="6.5" ${sw}/>
        ${o.tailTip || ''}
      </g>`;

    let body;
    if (o.body === 'loaf') {
      body = `<path d="M14 102 Q12 62 60 60 Q108 62 106 102 Q106 112 96 112 L24 112 Q14 112 14 102 Z" fill="${o.fur}" stroke="${L}" stroke-width="3" ${sw}/>
        ${o.bodyPattern || ''}`;
    } else {
      body = `<path d="M38 66 Q24 110 42 112 L78 112 Q96 110 82 66 Z" fill="${o.bodyFur || o.fur}" stroke="${L}" stroke-width="3" ${sw}/>
        ${o.belly ? `<ellipse cx="60" cy="96" rx="12" ry="13" fill="${o.belly}"/>` : ''}
        ${o.bodyPattern || ''}`;
    }

    const paws = o.body === 'keys' ? `
      <g class="cc-paws">
        <g class="cc-paw-l"><ellipse cx="45" cy="89" rx="8.5" ry="5.5" fill="${o.paw || o.fur}" stroke="${L}" stroke-width="2.5"/></g>
        <g class="cc-paw-r"><ellipse cx="75" cy="89" rx="8.5" ry="5.5" fill="${o.paw || o.fur}" stroke="${L}" stroke-width="2.5"/></g>
      </g>` : o.body === 'loaf' ? `
      <g class="cc-paws">
        <ellipse cx="47" cy="111" rx="7" ry="3.8" fill="${o.paw || o.fur}" stroke="${L}" stroke-width="2.5"/>
        <ellipse cx="73" cy="111" rx="7" ry="3.8" fill="${o.paw || o.fur}" stroke="${L}" stroke-width="2.5"/>
      </g>` : `
      <g class="cc-paws">
        <ellipse cx="48" cy="111" rx="8" ry="5" fill="${o.paw || o.fur}" stroke="${L}" stroke-width="2.5"/>
        <ellipse cx="72" cy="111" rx="8" ry="5" fill="${o.paw || o.fur}" stroke="${L}" stroke-width="2.5"/>
      </g>`;

    const keyboard = o.body !== 'keys' ? '' : (() => {
      let keys = '';
      for (let r = 0; r < 2; r++) for (let i = 0; i < 8; i++) {
        keys += `<rect x="${16 + i * 11.2 + (r ? 4 : 0)}" y="${95 + r * 6.5}" width="${r && i === 7 ? 4 : 8}" height="4.6" rx="1.2" fill="#F5F7FB"/>`;
      }
      return `<g class="cc-keyboard">
        <rect x="9" y="90" width="102" height="25" rx="5" fill="#C9D0DB" stroke="#39414E" stroke-width="2.5"/>
        ${keys}<rect x="36" y="108" width="48" height="4" rx="1.5" fill="#F5F7FB"/>
      </g>`;
    })();

    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" aria-hidden="true" focusable="false">
  <g class="cc-all">
    ${o.back || ''}
    ${tail}
    <g class="cc-body">${body}</g>
    <g class="cc-head">
      ${o.noEars ? '' : `
      <path d="M33 40 L35 11 L57 28 Z" fill="${o.fur}" stroke="${L}" stroke-width="3" ${sw}/>
      <path d="M87 40 L85 11 L63 28 Z" fill="${o.fur}" stroke="${L}" stroke-width="3" ${sw}/>
      <path d="M38.5 31 L39.5 18.5 L50 27 Z" fill="${o.innerEar || PINK}"/>
      <path d="M81.5 31 L80.5 18.5 L70 27 Z" fill="${o.innerEar || PINK}"/>`}
      <ellipse cx="60" cy="50" rx="31" ry="26" fill="${o.fur}" stroke="${L}" stroke-width="3"/>
      ${o.headPattern || ''}
      ${o.muzzle ? `<ellipse cx="60" cy="61" rx="13" ry="9" fill="${o.muzzle}"/>` : ''}
      ${o.cheeks === false ? '' : `<circle cx="40" cy="58" r="3.8" fill="#FF9AAB" opacity=".45"/><circle cx="80" cy="58" r="3.8" fill="#FF9AAB" opacity=".45"/>`}
      ${o.faceBack || ''}
      ${eyesNormal}
      <g class="cc-eyes-happy" opacity="0">
        <path d="M43 51 Q48 43.5 53 51 M67 51 Q72 43.5 77 51" fill="none" stroke="${F}" stroke-width="3" ${sw}/>
      </g>
      <g class="cc-eyes-shock" opacity="0">
        <circle cx="47" cy="48" r="8" fill="#fff" stroke="${L}" stroke-width="2.5"/>
        <circle cx="73" cy="48" r="8" fill="#fff" stroke="${L}" stroke-width="2.5"/>
        <circle cx="47" cy="48" r="2.3" fill="#1B1B1B"/><circle cx="73" cy="48" r="2.3" fill="#1B1B1B"/>
      </g>
      <g class="cc-eyes-faint" opacity="0">
        <path d="M44 45 L52 53 M52 45 L44 53 M68 45 L76 53 M76 45 L68 53" stroke="${F}" stroke-width="3" ${sw}/>
      </g>
      <g class="cc-eyes-love" opacity="0">
        <path d="M47 54.5 C37 48 41.5 40 47 45.5 C52.5 40 57 48 47 54.5 Z" fill="#FF4F7B" stroke="${L}" stroke-width="1.5" stroke-linejoin="round"/>
        <path d="M73 54.5 C63 48 67.5 40 73 45.5 C78.5 40 83 48 73 54.5 Z" fill="#FF4F7B" stroke="${L}" stroke-width="1.5" stroke-linejoin="round"/>
      </g>
      <g class="cc-eyes-worried" opacity="0">
        <circle cx="47" cy="49" r="5.8" fill="#fff" stroke="${L}" stroke-width="2"/>
        <circle cx="73" cy="49" r="5.8" fill="#fff" stroke="${L}" stroke-width="2"/>
        <circle cx="45.5" cy="47" r="2.4" fill="#1B1B1B"/><circle cx="71.5" cy="47" r="2.4" fill="#1B1B1B"/>
        <path d="M39 41 L52 37 M81 41 L68 37" stroke="${F}" stroke-width="2.6" ${sw}/>
      </g>
      <path d="M56.5 57 L63.5 57 L60 61 Z" fill="${o.nose || PINK}" stroke="${L}" stroke-width="1.5" ${sw}/>
      ${mouthNormal}
      <g class="cc-mouth-worried" opacity="0">
        <path d="M51.5 67.5 Q54.5 64.5 57.5 67.5 Q60.5 70.5 63.5 67.5 Q66.5 64.5 69.5 67.5" fill="none" stroke="${o.mouth || L}" stroke-width="2.2" ${sw}/>
      </g>
      <g class="cc-sweat" opacity="0">
        <path d="M89 25 Q84 34 89 37.5 Q94 34 89 25 Z" fill="#8FD0FF" stroke="${L}" stroke-width="1.5" stroke-linejoin="round"/>
      </g>
      <g class="cc-mouth-open" opacity="0">
        <ellipse cx="60" cy="67" rx="5" ry="6.5" fill="#5B1F24" stroke="${o.mouth || L}" stroke-width="2"/>
        <ellipse cx="60" cy="70.5" rx="3" ry="2" fill="${PINK}"/>
      </g>
      <path d="M29 55 L43 57.5 M29 62 L43 61 M91 55 L77 57.5 M91 62 L77 61" stroke="${o.whisker || L}" stroke-width="1.5" opacity=".7" ${sw}/>
      ${o.headExtra || ''}
    </g>
    ${keyboard}
    ${paws}
    ${o.front || ''}
  </g>
</svg>`;
  }

  const DESIGNS = {
    loaf: {
      fur: '#F6AA4B', line: '#7A4210', muzzle: '#FFE2BD', paw: '#FFE2BD', body: 'loaf',
      tailPath: 'M100 108 Q114 106 110 92',
      headPattern: '<path d="M52 27 L54 34 M60 25 L60 33 M68 27 L66 34" stroke="#D9812A" stroke-width="3" stroke-linecap="round"/>',
      bodyPattern: '<path d="M30 76 Q34 84 30 92 M90 76 Q86 84 90 92 M40 70 Q43 76 40 82 M80 70 Q77 76 80 82" fill="none" stroke="#D9812A" stroke-width="3" stroke-linecap="round"/>',
    },
    judge: {
      fur: '#A9B2BC', line: '#343C46', muzzle: '#E6EAEE', belly: '#E6EAEE', paw: '#E6EAEE', body: 'sit',
      eyesNormal: `
        <g class="cc-eyes-normal">
          <path d="M41 50 Q48 45 55 50 Q48 54 41 50 Z" fill="#F4F0C8" stroke="#343C46" stroke-width="2"/>
          <path d="M65 50 Q72 45 79 50 Q72 54 65 50 Z" fill="#F4F0C8" stroke="#343C46" stroke-width="2"/>
          <g class="cc-pupils"><circle cx="52" cy="50" r="2.3" fill="#1F242B"/><circle cx="76" cy="50" r="2.3" fill="#1F242B"/></g>
          <path d="M39 45.5 L56 48.5 M81 45.5 L64 48.5" stroke="#343C46" stroke-width="3.2" stroke-linecap="round"/>
        </g>`,
      mouthNormal: '<g class="cc-mouth-normal"><path d="M54 65 Q60 63 66 65" fill="none" stroke="#343C46" stroke-width="2" stroke-linecap="round"/></g>',
      headPattern: '<path d="M46 30 Q60 24 74 30" fill="none" stroke="#8A939D" stroke-width="3" stroke-linecap="round"/>',
    },
    derp: {
      fur: '#F4E7D4', line: '#5B4636', muzzle: '#FFF6EA', belly: '#FFF6EA', body: 'sit',
      headPattern: '<ellipse cx="73" cy="37" rx="10" ry="7.5" fill="#BE8A5E"/><ellipse cx="42" cy="66" rx="5" ry="3.5" fill="#BE8A5E"/>',
      bodyPattern: '<ellipse cx="72" cy="80" rx="7" ry="9" fill="#BE8A5E"/>',
      tailTip: '<circle cx="94" cy="78" r="3.2" fill="#BE8A5E"/>',
      eyesNormal: `
        <g class="cc-eyes-normal">
          <circle cx="47" cy="48" r="7.2" fill="#fff" stroke="#5B4636" stroke-width="2.2"/>
          <circle cx="44" cy="45" r="2.8" fill="#2A1C12"/>
          <circle cx="73" cy="51" r="4.3" fill="#fff" stroke="#5B4636" stroke-width="2"/>
          <circle cx="74.8" cy="52.8" r="1.8" fill="#2A1C12"/>
        </g>`,
      mouthNormal: `
        <g class="cc-mouth-normal">
          <path d="M57 62 Q56.5 73 61 73 Q65.5 73 64.5 63 Z" fill="#F07C92" stroke="#5B4636" stroke-width="1.6" stroke-linejoin="round"/>
          <path d="M60.6 64 L60.8 70" stroke="#C85A70" stroke-width="1.2" stroke-linecap="round"/>
          <path d="M60 61 Q57 66 53 64 M60 61 Q63 66 67 64" fill="none" stroke="#5B4636" stroke-width="2" stroke-linecap="round"/>
        </g>`,
    },
    screamer: {
      fur: '#FBFAF7', line: '#3A3434', muzzle: '#FFFFFF', body: 'sit',
      headPattern: '<path d="M33 40 L35 11 L50 24 Q40 30 36 44 Z" fill="#F2A04B"/><ellipse cx="80" cy="44" rx="8" ry="9" fill="#2E2A2A"/>',
      bodyPattern: '<ellipse cx="50" cy="84" rx="8" ry="10" fill="#F2A04B"/><ellipse cx="73" cy="100" rx="6" ry="7" fill="#2E2A2A"/>',
      tailTip: '<circle cx="94" cy="78" r="3.2" fill="#2E2A2A"/>',
      mouthNormal: '<g class="cc-mouth-normal"><ellipse cx="60" cy="65" rx="2.6" ry="3.2" fill="#5B1F24" stroke="#3A3434" stroke-width="1.4"/></g>',
    },
    keys: {
      fur: '#2F3140', line: '#12131A', muzzle: '#F6F6F6', belly: '#F6F6F6', paw: '#F6F6F6', feat: '#F7D154',
      whisker: '#C9CCD8', body: 'keys',
      eyesNormal: `
        <g class="cc-eyes-normal">
          <ellipse cx="48" cy="49" rx="4.8" ry="5.8" fill="#F7D154"/><ellipse cx="72" cy="49" rx="4.8" ry="5.8" fill="#F7D154"/>
          <ellipse cx="48" cy="49.5" rx="1.7" ry="4.2" fill="#12131A"/><ellipse cx="72" cy="49.5" rx="1.7" ry="4.2" fill="#12131A"/>
        </g>`,
    },
    void: {
      fur: '#17151F', line: '#44405C', feat: '#D6FF5C', whisker: '#6B6690', mouth: '#8C87AE', body: 'sit',
      innerEar: '#3A2E45', nose: '#3A2E45', cheeks: false,
      faceBack: '<g class="cc-glow" opacity=".3"><circle cx="48" cy="49" r="11" fill="#D6FF5C"/><circle cx="72" cy="49" r="11" fill="#D6FF5C"/></g>',
      eyesNormal: `
        <g class="cc-eyes-normal">
          <path d="M41 49 Q48 40 55 49 Q48 57 41 49 Z" fill="#D6FF5C"/>
          <path d="M65 49 Q72 40 79 49 Q72 57 65 49 Z" fill="#D6FF5C"/>
          <ellipse cx="48" cy="49" rx="1.4" ry="4.8" fill="#0B0A10"/><ellipse cx="72" cy="49" rx="1.4" ry="4.8" fill="#0B0A10"/>
        </g>`,
    },

    // ---- meme-style cats (original drawings) ----
    pop: {
      fur: '#EFE7DA', line: '#4A3F36', muzzle: '#FFFFFF', belly: '#FFFFFF', paw: '#FFFFFF', body: 'sit',
      headPattern: '<path d="M44 27 Q60 20 76 27 Q70 34 60 33 Q50 34 44 27 Z" fill="#CDBFAE"/>',
      eyesNormal: `
        <g class="cc-eyes-normal">
          <circle cx="47" cy="48" r="6" fill="#2A1C12"/><circle cx="73" cy="48" r="6" fill="#2A1C12"/>
          <circle cx="49" cy="45.5" r="2.2" fill="#fff"/><circle cx="75" cy="45.5" r="2.2" fill="#fff"/>
          <circle cx="45" cy="50.5" r="1" fill="#fff"/><circle cx="71" cy="50.5" r="1" fill="#fff"/>
        </g>`,
      mouthNormal: '<g class="cc-mouth-normal"><path d="M55 64 Q60 67.5 65 64" fill="none" stroke="#4A3F36" stroke-width="2" stroke-linecap="round"/></g>',
      headExtra: `
        <g class="cc-pop" opacity="0">
          <path d="M49 62 Q60 57 71 62 Q72.5 80 60 81 Q47.5 80 49 62 Z" fill="#5B1F24" stroke="#4A3F36" stroke-width="2.2" stroke-linejoin="round"/>
          <ellipse cx="60" cy="76" rx="6" ry="3" fill="${PINK}"/>
        </g>`,
    },
    monday: {
      fur: '#D8C7B3', line: '#4B3A2C', muzzle: '#F4ECE2', belly: '#F4ECE2', paw: '#F4ECE2', body: 'sit', cheeks: false,
      headPattern: '<path d="M35 52 Q38 37 60 39 Q82 37 85 52 Q81 59 72 57 L60 55 L48 57 Q39 59 35 52 Z" fill="#8C7560"/>',
      eyesNormal: `
        <g class="cc-eyes-normal">
          <ellipse cx="48" cy="50" rx="5.5" ry="4.8" fill="#9CCBF0"/><ellipse cx="72" cy="50" rx="5.5" ry="4.8" fill="#9CCBF0"/>
          <circle cx="48" cy="51.5" r="2.2" fill="#1B1B1B"/><circle cx="72" cy="51.5" r="2.2" fill="#1B1B1B"/>
          <path d="M42 50.5 Q48 43 54 50.5 Z M66 50.5 Q72 43 78 50.5 Z" fill="#8C7560" stroke="#4B3A2C" stroke-width="1.6" stroke-linejoin="round"/>
          <path d="M41 43 L54 46.5 M79 43 L66 46.5" stroke="#4B3A2C" stroke-width="3" stroke-linecap="round"/>
        </g>`,
      mouthNormal: '<g class="cc-mouth-normal"><path d="M60 61 L60 63.5 M49.5 69 Q60 60.5 70.5 69" fill="none" stroke="#4B3A2C" stroke-width="2.6" stroke-linecap="round"/></g>',
    },
    vibe: {
      fur: '#8B8F9C', line: '#2E3038', muzzle: '#F2F2F2', belly: '#F2F2F2', paw: '#F2F2F2', body: 'sit', feat: '#1F2026',
      eyesNormal: '<g class="cc-eyes-normal"><path d="M43 49 Q48 54 53 49 M67 49 Q72 54 77 49" fill="none" stroke="#1F2026" stroke-width="3" stroke-linecap="round"/></g>',
      headExtra: `
        <g class="cc-phones">
          <path d="M28 50 Q27 15 60 15 Q93 15 92 50" fill="none" stroke="#E0457B" stroke-width="5" stroke-linecap="round"/>
          <rect x="21" y="41" width="12" height="21" rx="5.5" fill="#E0457B" stroke="#2E3038" stroke-width="2"/>
          <rect x="87" y="41" width="12" height="21" rx="5.5" fill="#E0457B" stroke="#2E3038" stroke-width="2"/>
        </g>`,
      front: `
        <g class="cc-note">
          <path d="M100 30 L100 14 L109 11.5 L109 26" fill="none" stroke="#E0457B" stroke-width="2.6" stroke-linejoin="round"/>
          <ellipse cx="97.4" cy="30" rx="3.3" ry="2.6" fill="#E0457B"/><ellipse cx="106.4" cy="26" rx="3.3" ry="2.6" fill="#E0457B"/>
        </g>`,
    },
    sadthumbs: {
      fur: '#F2C27F', line: '#6E4A1E', muzzle: '#FFE9C9', belly: '#FFE9C9', paw: '#FFE9C9', body: 'sit',
      tailPath: 'M40 106 Q14 108 16 86 Q17 74 26 78',
      eyesNormal: teary('#6E4A1E'),
      mouthNormal: '<g class="cc-mouth-normal"><path d="M60 61 L60 63 M53 68 Q56.5 64.5 60 66.5 Q63.5 64.5 67 68" fill="none" stroke="#6E4A1E" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></g>',
      headExtra: '<g class="cc-tear"><path d="M42 57 Q38.5 63.5 42 66 Q45.5 63.5 42 57 Z" fill="#7FC4F2"/></g>',
      front: `
        <g class="cc-thumb">
          <rect x="84" y="69" width="7.5" height="15" rx="3.7" fill="#FFE9C9" stroke="#6E4A1E" stroke-width="2.5"/>
          <ellipse cx="88" cy="88" rx="9.5" ry="8" fill="#FFE9C9" stroke="#6E4A1E" stroke-width="2.5"/>
          <path d="M81 86 L91 86 M81.5 90.5 L91.5 90.5" stroke="#6E4A1E" stroke-width="1.6" stroke-linecap="round"/>
        </g>`,
    },
    huh: {
      fur: '#ECE8E2', line: '#4A4540', muzzle: '#FFFFFF', belly: '#FFFFFF', paw: '#FFFFFF', body: 'sit',
      headPattern: '<path d="M60 25 Q74 24 84 34 Q86 44 80 46 Q70 34 60 33 Z" fill="#A89F94"/>',
      tailTip: '<circle cx="94" cy="78" r="3.2" fill="#A89F94"/>',
      eyesNormal: `
        <g class="cc-eyes-normal">
          <circle cx="47" cy="48" r="6.5" fill="#fff" stroke="#4A4540" stroke-width="2"/>
          <circle cx="73" cy="48" r="6.5" fill="#fff" stroke="#4A4540" stroke-width="2"/>
          <circle cx="48.5" cy="45" r="3" fill="#1B1B1B"/><circle cx="74.5" cy="45" r="3" fill="#1B1B1B"/>
          <path d="M40 38 L53 40 M67 37 Q73 33 80 36" fill="none" stroke="#4A4540" stroke-width="2.5" stroke-linecap="round"/>
        </g>`,
      mouthNormal: '<g class="cc-mouth-normal"><path d="M60 61 L60 63 M54 66 Q57 63.5 60 66 Q63 68.5 66 66" fill="none" stroke="#4A4540" stroke-width="2" stroke-linecap="round"/></g>',
      front: `
        <g class="cc-q">
          <path d="M96 17 Q96 8 103 8 Q110 8 110 15 Q110 20 104.5 23 Q102 24.5 102 28" fill="none" stroke="#F6AA4B" stroke-width="4.2" stroke-linecap="round"/>
          <circle cx="102" cy="34" r="2.7" fill="#F6AA4B"/>
        </g>`,
    },
    banana: {
      fur: '#DCD6CE', bodyFur: '#FFE066', line: '#5A4A2A', muzzle: '#F6F3EE', paw: '#DCD6CE', body: 'sit',
      noEars: true, tail: false,
      back: `
        <path d="M60 9 Q97 20 97 58 Q96 81 60 83 Q24 81 23 58 Q23 20 60 9 Z" fill="#FFE066" stroke="#8A6A10" stroke-width="3" stroke-linejoin="round"/>
        <path d="M56.5 10.5 L57.5 2 L63 2 L64 10.5 Z" fill="#6B4F1D" stroke="#4A3510" stroke-width="1.5" stroke-linejoin="round"/>
        <path d="M34 40 Q40 22 56 16" fill="none" stroke="#E6BF2E" stroke-width="3" stroke-linecap="round"/>`,
      bodyPattern: '<path d="M45 76 Q41 92 47 108 M75 76 Q79 92 73 108" fill="none" stroke="#E0B92E" stroke-width="3" stroke-linecap="round"/>',
      eyesNormal: teary('#5A4A2A'),
      mouthNormal: '<g class="cc-mouth-normal"><path d="M60 61 L60 63 M52 68.5 Q60 62 68 68.5" fill="none" stroke="#5A4A2A" stroke-width="2.2" stroke-linecap="round"/></g>',
      headExtra: '<g class="cc-tear"><path d="M42 57 Q38.5 63.5 42 66 Q45.5 63.5 42 57 Z" fill="#7FC4F2"/></g>',
    },
  };

  // Big glossy crying eyes with worried brows (Sad Thumbs, Banana).
  function teary(line) {
    return `
        <g class="cc-eyes-normal">
          <ellipse cx="47" cy="49" rx="7" ry="8" fill="#2A1C12"/><ellipse cx="73" cy="49" rx="7" ry="8" fill="#2A1C12"/>
          <circle cx="49.5" cy="46" r="2.7" fill="#fff"/><circle cx="75.5" cy="46" r="2.7" fill="#fff"/>
          <circle cx="44.8" cy="52.5" r="1.3" fill="#fff"/><circle cx="70.8" cy="52.5" r="1.3" fill="#fff"/>
          <path d="M40 55 Q47 59.5 54 55 M66 55 Q73 59.5 80 55" fill="none" stroke="#7FC4F2" stroke-width="2.6" stroke-linecap="round"/>
          <path d="M40 41 L52 37.5 M80 41 L68 37.5" stroke="${line}" stroke-width="2.6" stroke-linecap="round"/>
        </g>`;
  }

  function svg(id) {
    return catSvg(Object.hasOwn(DESIGNS, id) ? DESIGNS[id] : DESIGNS.loaf);
  }

  // Toolbar icons are tiny: crop to the head.
  function iconSvg(id) {
    return svg(id).replace('viewBox="0 0 120 120"', 'viewBox="24 7 72 72"');
  }

  const CSS = `
.cc{display:inline-block;position:relative;width:100%;height:100%;line-height:0;vertical-align:middle}
.cc svg{display:block;width:100%;height:100%;overflow:visible}
.cc img{display:block;width:100%;height:100%;object-fit:contain}
.cc svg g{transform-box:view-box}
.cc .cc-eyes-happy,.cc .cc-eyes-shock,.cc .cc-eyes-faint,.cc .cc-mouth-open,
.cc .cc-eyes-love,.cc .cc-eyes-worried,.cc .cc-mouth-worried,.cc .cc-sweat{opacity:0}
.cc.love .cc-eyes-normal{opacity:0}.cc.love .cc-eyes-love{opacity:1}
.cc.worried .cc-eyes-normal,.cc.worried .cc-mouth-normal{opacity:0}
.cc.worried .cc-eyes-worried,.cc.worried .cc-mouth-worried,.cc.worried .cc-sweat{opacity:1}
.cc-eyes-love path{transform-box:fill-box;transform-origin:center}
.cc.happy .cc-eyes-normal{opacity:0}.cc.happy .cc-eyes-happy{opacity:1}
.cc.shocked .cc-eyes-normal,.cc.shocked .cc-mouth-normal{opacity:0}
.cc.shocked .cc-eyes-shock,.cc.shocked .cc-mouth-open{opacity:1}
.cc.faint .cc-eyes-normal,.cc.faint .cc-mouth-normal{opacity:0}
.cc.faint .cc-eyes-faint,.cc.faint .cc-mouth-open{opacity:1}

.cc.happy .cc-all{animation:cc-bounce .55s ease-in-out infinite alternate}
.cc.love .cc-all{transform-origin:60px 112px;animation:cc-sway 1.6s ease-in-out infinite}
.cc.love .cc-eyes-love path{animation:cc-heart .45s ease-in-out infinite alternate}
.cc.worried .cc-all{animation:cc-fidget 2.2s ease-in-out infinite}
.cc.worried .cc-sweat{animation:cc-sweat 1.5s ease-in infinite}
.cc.shocked .cc-all{transform-origin:60px 112px;animation:cc-jolt 1s ease-out infinite}
.cc.faint .cc-all{transform-origin:60px 60px;transform:translateY(16px) rotate(90deg) scale(.8);animation:cc-faint 1.1s cubic-bezier(.5,-.4,.7,1) both}

.cc--loaf.idle .cc-eyes-normal,.cc--void.idle .cc-eyes-normal{transform-origin:60px 49px;animation:cc-blink 4.6s ease-in-out infinite}
.cc--void.idle .cc-eyes-normal{animation-duration:3.2s}
.cc--void .cc-glow{animation:cc-glow 2.2s ease-in-out infinite alternate}
.cc--judge.idle .cc-tail{transform-origin:80px 106px;animation:cc-flick 1.3s ease-in-out infinite alternate}
.cc--judge.idle .cc-pupils{animation:cc-side 5s ease-in-out infinite}
.cc--derp.idle .cc-head{transform-origin:60px 76px;animation:cc-wobble 1.8s ease-in-out infinite}
.cc--screamer.idle .cc-all{transform-origin:60px 112px;animation:cc-breathe 2.4s ease-in-out infinite}
.cc--screamer.shocked .cc-mouth-open,.cc--screamer.faint .cc-mouth-open{transform-origin:60px 67px;transform:scale(2.1);animation:cc-scream .45s cubic-bezier(.2,1.7,.4,1) both}
.cc--keys.idle .cc-paw-l,.cc--keys.happy .cc-paw-l{animation:cc-tap .3s ease-in-out infinite alternate}
.cc--keys.idle .cc-paw-r,.cc--keys.happy .cc-paw-r{animation:cc-tap .3s ease-in-out .15s infinite alternate}
.cc--keys.idle .cc-head{animation:cc-bob .6s ease-in-out infinite alternate}

.cc--pop.idle .cc-pop,.cc--pop.happy .cc-pop{animation:cc-pop-on .8s linear infinite}
.cc--pop.idle .cc-mouth-normal,.cc--pop.happy .cc-mouth-normal{animation:cc-pop-off .8s linear infinite}
.cc--monday.idle .cc-all{transform-origin:60px 112px;animation:cc-sigh 3.6s ease-in-out infinite}
.cc--vibe.idle .cc-head,.cc--vibe.happy .cc-head{transform-origin:60px 78px;animation:cc-vibe .45s ease-in-out infinite alternate}
.cc--vibe .cc-note{animation:cc-float 1.8s ease-in-out infinite}
.cc--sadthumbs.idle .cc-tear,.cc--banana.idle .cc-tear{animation:cc-tear 1.9s ease-in infinite}
.cc--sadthumbs .cc-tear,.cc--banana .cc-tear{opacity:0}
.cc--sadthumbs.idle .cc-tear,.cc--banana.idle .cc-tear{opacity:1}
.cc--sadthumbs.idle .cc-thumb,.cc--sadthumbs.happy .cc-thumb{transform-origin:88px 94px;animation:cc-thumb 1.1s ease-in-out infinite alternate}
.cc--huh.idle .cc-head{transform-origin:60px 78px;animation:cc-tilt 2.8s ease-in-out infinite}
.cc--huh.idle .cc-q{transform-origin:102px 30px;animation:cc-qpop 2.8s ease-in-out infinite}
.cc--banana.idle .cc-all{transform-origin:60px 112px;animation:cc-sway 2.4s ease-in-out infinite}

.cc--custom.idle img{transform-origin:50% 100%;animation:cc-breathe 2.4s ease-in-out infinite}
.cc--custom.happy img{animation:cc-hop .5s ease-in-out infinite alternate}
.cc--custom.shocked img{animation:cc-shake .4s linear infinite}
.cc--custom.love img{animation:cc-heart-img .5s ease-in-out infinite alternate}
.cc--custom.worried img{animation:cc-fidget-img 1.3s ease-in-out infinite}
.cc--custom.faint img{transform:rotate(90deg) scale(.85);opacity:.7;animation:cc-faint-img 1s ease-in both}

@keyframes cc-bounce{from{transform:translateY(0)}to{transform:translateY(-7px)}}
@keyframes cc-jolt{0%{transform:none}10%{transform:translateY(-13px) scale(1.07)}20%{transform:translate(-3px,-6px)}28%{transform:translate(3px,-6px)}36%{transform:translate(-2px,-3px)}48%,100%{transform:none}}
@keyframes cc-faint{0%{transform:none}30%{transform:rotate(-12deg)}100%{transform:translateY(16px) rotate(90deg) scale(.8)}}
@keyframes cc-blink{0%,86%,100%{transform:scaleY(1)}91%,95%{transform:scaleY(.08)}}
@keyframes cc-glow{from{opacity:.12}to{opacity:.55}}
@keyframes cc-flick{from{transform:rotate(-10deg)}to{transform:rotate(16deg)}}
@keyframes cc-side{0%,35%,100%{transform:none}45%,85%{transform:translateX(-6px)}}
@keyframes cc-wobble{0%,100%{transform:rotate(-9deg)}50%{transform:rotate(9deg)}}
@keyframes cc-breathe{0%,100%{transform:scale(1)}50%{transform:scale(1.035,.975)}}
@keyframes cc-scream{from{transform:scale(.2)}to{transform:scale(2.1)}}
@keyframes cc-tap{from{transform:translateY(0)}to{transform:translateY(-5px)}}
@keyframes cc-bob{from{transform:translateY(0)}to{transform:translateY(2px)}}
@keyframes cc-pop-on{0%,49%{opacity:0}50%,100%{opacity:1}}
@keyframes cc-pop-off{0%,49%{opacity:1}50%,100%{opacity:0}}
@keyframes cc-sigh{0%,100%{transform:none}45%{transform:translateY(1.5px) scale(1.03,.96)}}
@keyframes cc-vibe{from{transform:translateY(0) rotate(-4deg)}to{transform:translateY(4px) rotate(4deg)}}
@keyframes cc-float{0%{transform:translateY(6px);opacity:0}30%{opacity:1}100%{transform:translateY(-10px);opacity:0}}
@keyframes cc-tear{0%{transform:translateY(0);opacity:0}15%{opacity:1}100%{transform:translateY(28px);opacity:0}}
@keyframes cc-thumb{from{transform:rotate(-9deg)}to{transform:rotate(9deg)}}
@keyframes cc-tilt{0%,100%{transform:none}30%,70%{transform:rotate(-14deg)}}
@keyframes cc-qpop{0%,20%,88%,100%{transform:scale(0)}32%,76%{transform:scale(1)}}
@keyframes cc-sway{0%,100%{transform:rotate(-4deg)}50%{transform:rotate(4deg)}}
@keyframes cc-heart{from{transform:scale(.8)}to{transform:scale(1.15)}}
@keyframes cc-fidget{0%,100%{transform:none}15%{transform:translateX(-1.5px)}30%{transform:translateX(1.5px)}45%{transform:translateX(-1px)}60%{transform:none}}
@keyframes cc-sweat{0%{transform:translateY(-3px);opacity:0}25%{opacity:1}100%{transform:translateY(9px);opacity:0}}
@keyframes cc-heart-img{from{transform:scale(1)}to{transform:scale(1.1)}}
@keyframes cc-fidget-img{0%,100%{transform:none}25%{transform:translateX(-3%)}75%{transform:translateX(3%)}}
@keyframes cc-hop{from{transform:translateY(0)}to{transform:translateY(-10%)}}
@keyframes cc-shake{0%,100%{transform:none}25%{transform:translateX(-6%) rotate(-4deg)}75%{transform:translateX(6%) rotate(4deg)}}
@keyframes cc-faint-img{0%{transform:none;opacity:1}30%{transform:rotate(-12deg)}100%{transform:rotate(90deg) scale(.85);opacity:.7}}

@media (prefers-reduced-motion:reduce){.cc,.cc *{animation:none!important;transition:none!important}}
`;

  const STATES = ['love', 'happy', 'idle', 'worried', 'shocked', 'faint'];

  // Build a cat element. id may be 'custom:<id>' (uses customUrl, falls back to Loaf).
  function create(doc, id, state = 'idle', customUrl = null) {
    const el = doc.createElement('div');
    fill(el, id, customUrl);
    setState(el, state);
    return el;
  }

  function fill(el, id, customUrl) {
    const useCustom = /^custom(:|$)/.test(id) && typeof customUrl === 'string' && customUrl.startsWith('data:image/');
    const realId = useCustom ? 'custom' : Object.hasOwn(DESIGNS, id) ? id : 'loaf';
    el.dataset.cat = realId;
    el.dataset.mascot = id; // what was asked for, e.g. "custom:abc"
    el.textContent = '';
    if (useCustom) {
      const img = el.ownerDocument.createElement('img');
      img.alt = '';
      img.onerror = () => fill(el, 'loaf'); // e.g. blocked by a strict page CSP
      img.src = customUrl;
      el.appendChild(img);
    } else {
      el.innerHTML = svg(realId); // static, extension-authored markup
    }
    setState(el, el.dataset.state || 'idle');
  }

  function setState(el, state) {
    const s = STATES.includes(state) ? state : 'idle';
    el.dataset.state = s;
    el.className = `cc cc--${el.dataset.cat} ${s}`;
  }

  CL.cats = { LIST, STATES, CSS, svg, iconSvg, create, fill, setState };
})(globalThis);
