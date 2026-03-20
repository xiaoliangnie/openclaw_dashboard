const _ = null;
const T = 'transparent';

// 16 wide x 20 tall pixel grids
// Color palettes per agent
const palettes = {
  main: {
    skin: '#f5c6a0',
    skinShade: '#d9a67a',
    hair: '#3a2a1a',
    hairHi: '#5a3e28',
    shirt: '#4a7ddf',
    shirtShade: '#3a5fa8',
    pants: '#3a3a5a',
    eye: '#1a1a2e',
    mouth: '#c47a60',
    shoe: '#2a2a3a',
  },
  ayang: {
    skin: '#f5d0b8',
    skinShade: '#ddb090',
    hair: '#c8a878',
    hairHi: '#e0c898',
    shirt: '#8a5ec0',
    shirtShade: '#6a3ea0',
    pants: '#4a4060',
    eye: '#2a1a3e',
    mouth: '#d08070',
    shoe: '#3a2a4a',
  },
  zhiyu: {
    skin: '#f0c8a8',
    skinShade: '#d0a880',
    hair: '#2a3a2a',
    hairHi: '#3a5a3a',
    shirt: '#4aaa70',
    shirtShade: '#2a8850',
    pants: '#3a4a3a',
    eye: '#1a1a2e',
    mouth: '#c07a60',
    shoe: '#2a3a2a',
    glasses: '#88ccff',
    glassesFrame: '#4488aa',
  },
};

// Grid key: S=skin, D=skinShade, H=hair, h=hairHi, B=shirt, b=shirtShade, P=pants, E=eye, M=mouth, O=shoe, G=glasses, F=glassesFrame
function buildGrid(agentId) {
  // Universal shape, different colors per palette
  const grids = {
    main: [
      //0  1  2  3  4  5  6  7  8  9  10 11 12 13 14 15
      [_,_,_,_,_,'H','H','H','H','H','H',_,_,_,_,_],  // 0  top of hair
      [_,_,_,_,'H','H','H','H','H','H','H','H',_,_,_,_],  // 1
      [_,_,_,'H','H','h','H','H','H','H','h','H','H',_,_,_],  // 2
      [_,_,_,'H','H','H','H','H','H','H','H','H','H',_,_,_],  // 3
      [_,_,_,'H','S','S','S','S','S','S','S','S','H',_,_,_],  // 4  face start
      [_,_,_,'S','S','E',_,'S','S',_,'E','S','S',_,_,_],  // 5  eyes
      [_,_,_,'S','S','S','S','S','S','S','S','S','S',_,_,_],  // 6
      [_,_,_,_,'S','S','S','M','M','S','S','S',_,_,_,_],  // 7  mouth
      [_,_,_,_,'S','S','D','S','S','D','S','S',_,_,_,_],  // 8  chin
      [_,_,_,_,_,'S','S','S','S','S','S',_,_,_,_,_],  // 9  neck
      [_,_,_,'B','B','B','B','B','B','B','B','B','B',_,_,_],  // 10 shirt
      [_,_,'B','B','B','b','B','B','B','B','b','B','B','B',_,_],  // 11
      [_,_,'B','B','B','b','B','B','B','B','b','B','B','B',_,_],  // 12
      [_,_,_,'S','B','B','B','B','B','B','B','B','S',_,_,_],  // 13 arms (skin)
      [_,_,_,'S','B','B','B','B','B','B','B','B','S',_,_,_],  // 14
      [_,_,_,_,_,'B','B','B','B','B','B',_,_,_,_,_],  // 15
      [_,_,_,_,_,'P','P','P','P','P','P',_,_,_,_,_],  // 16 pants
      [_,_,_,_,_,'P','P',_,_,'P','P',_,_,_,_,_],  // 17
      [_,_,_,_,_,'P','P',_,_,'P','P',_,_,_,_,_],  // 18
      [_,_,_,_,'O','O','O',_,_,'O','O','O',_,_,_,_],  // 19 shoes
    ],
    ayang: [
      [_,_,_,_,_,'H','H','H','H','H','H',_,_,_,_,_],
      [_,_,_,'H','H','H','h','h','h','H','H','H',_,_,_,_],
      [_,_,'H','H','h','h','H','H','H','h','h','H','H',_,_,_],
      [_,_,'H','H','H','H','H','H','H','H','H','H','H',_,_,_],
      [_,_,_,'H','S','S','S','S','S','S','S','S','H',_,_,_],
      [_,_,_,'S','S','E',_,'S','S',_,'E','S','S',_,_,_],
      [_,_,_,'S','S','S','S','S','S','S','S','S','S',_,_,_],
      [_,_,_,_,'S','S','S','M','M','S','S','S',_,_,_,_],
      [_,_,_,_,'S','S','D','S','S','D','S','S',_,_,_,_],
      [_,_,_,_,_,'S','S','S','S','S','S',_,_,_,_,_],
      [_,_,_,'B','B','B','B','B','B','B','B','B','B',_,_,_],
      [_,_,'B','B','B','b','B','B','B','B','b','B','B','B',_,_],
      [_,_,'B','B','B','b','B','B','B','B','b','B','B','B',_,_],
      [_,_,_,'S','B','B','B','B','B','B','B','B','S',_,_,_],
      [_,_,_,'S','B','B','B','B','B','B','B','B','S',_,_,_],
      [_,_,_,_,_,'B','B','B','B','B','B',_,_,_,_,_],
      [_,_,_,_,_,'P','P','P','P','P','P',_,_,_,_,_],
      [_,_,_,_,_,'P','P',_,_,'P','P',_,_,_,_,_],
      [_,_,_,_,_,'P','P',_,_,'P','P',_,_,_,_,_],
      [_,_,_,_,'O','O','O',_,_,'O','O','O',_,_,_,_],
    ],
    zhiyu: [
      [_,_,_,_,_,'H','H','H','H','H','H',_,_,_,_,_],
      [_,_,_,_,'H','H','H','H','H','H','H','H',_,_,_,_],
      [_,_,_,'H','H','h','H','H','H','H','h','H','H',_,_,_],
      [_,_,_,'H','H','H','H','H','H','H','H','H','H',_,_,_],
      [_,_,_,'H','S','S','S','S','S','S','S','S','H',_,_,_],
      [_,_,_,'S','F','G','F',_,_,'F','G','F','S',_,_,_],  // glasses
      [_,_,_,'S','S','S','S','S','S','S','S','S','S',_,_,_],
      [_,_,_,_,'S','S','S','M','M','S','S','S',_,_,_,_],
      [_,_,_,_,'S','S','D','S','S','D','S','S',_,_,_,_],
      [_,_,_,_,_,'S','S','S','S','S','S',_,_,_,_,_],
      [_,_,_,'B','B','B','B','B','B','B','B','B','B',_,_,_],
      [_,_,'B','B','B','b','B','B','B','B','b','B','B','B',_,_],
      [_,_,'B','B','B','b','B','B','B','B','b','B','B','B',_,_],
      [_,_,_,'S','B','B','B','B','B','B','B','B','S',_,_,_],
      [_,_,_,'S','B','B','B','B','B','B','B','B','S',_,_,_],
      [_,_,_,_,_,'B','B','B','B','B','B',_,_,_,_,_],
      [_,_,_,_,_,'P','P','P','P','P','P',_,_,_,_,_],
      [_,_,_,_,_,'P','P',_,_,'P','P',_,_,_,_,_],
      [_,_,_,_,_,'P','P',_,_,'P','P',_,_,_,_,_],
      [_,_,_,_,'O','O','O',_,_,'O','O','O',_,_,_,_],
    ],
  };

  return grids[agentId] || grids.main;
}

const colorMap = {
  S: 'skin', D: 'skinShade', H: 'hair', h: 'hairHi',
  B: 'shirt', b: 'shirtShade', P: 'pants', E: 'eye',
  M: 'mouth', O: 'shoe', G: 'glasses', F: 'glassesFrame',
};

const sizeMap = { sm: 2, md: 4, lg: 6 };

export function PixelAvatar({ agentId = 'main', size = 'md' }) {
  const px = sizeMap[size] || sizeMap.md;
  const grid = buildGrid(agentId);
  const pal = palettes[agentId] || palettes.main;
  const w = 16 * px;
  const h = 20 * px;

  const rects = [];
  for (let row = 0; row < grid.length; row++) {
    for (let col = 0; col < grid[row].length; col++) {
      const key = grid[row][col];
      if (!key) continue;
      const colorName = colorMap[key];
      const fill = pal[colorName] || T;
      if (fill === T) continue;
      rects.push(
        <rect key={`${row}-${col}`} x={col * px} y={row * px} width={px} height={px} fill={fill} />
      );
    }
  }

  return (
    <svg
      className="pixel-avatar"
      width={w}
      height={h}
      viewBox={`0 0 ${w} ${h}`}
      xmlns="http://www.w3.org/2000/svg"
      style={{ imageRendering: 'pixelated' }}
    >
      {rects}
    </svg>
  );
}
