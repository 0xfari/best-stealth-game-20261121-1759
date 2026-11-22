// Drawing only: the world's state and the current screen in, pixels out. The 1280x720
// playfield is scaled to fit the window and centred, the margin filled with the backdrop
// colour. Lamplight pools, vision cones, cover and characters are all flat canvas shapes;
// text that holds a number is rebuilt only when the number changes, so a frame allocates
// nothing.

import { FIELD, FONT, LIVES, PALETTE, TILE } from './config.js';
import { GUARD_ALERT, GUARD_SEARCH, GUARD_SUSPICIOUS } from './guard.js';
import { TILE_COVER, TILE_DARK, TILE_LAMP, TILE_WALL, isSolid } from './level.js';
import { drawCoins } from './distraction.js';
import { drawLighting, drawNearMiss } from './lighting.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_LEVEL = 'level';
export const SCREEN_CAUGHT = 'caught';
export const SCREEN_OVER = 'over';
export const SCREEN_WIN = 'win';

const PANEL = { width: 640, top: 150, line: 32, bottom: 76 };
const CONE_HALF = 0.61;
const ARTIFACT_COLOURS = [PALETTE.artifactJade, PALETTE.artifactPearl, PALETTE.artifactGold];

function cachedLabel(prefix) {
  let value = null;
  let text = '';
  return function label(next) {
    if (next !== value) {
      value = next;
      text = prefix + next;
    }
    return text;
  };
}

function formatTime(seconds) {
  const whole = Math.floor(seconds);
  const minutes = Math.floor(whole / 60);
  const rest = whole % 60;
  return `${minutes}:${rest < 10 ? '0' : ''}${rest}`;
}

export function createRenderer(canvas) {
  const context = canvas.getContext('2d');
  const view = { scale: 1, x: 0, y: 0 };
  const scoreLabel = cachedLabel('Score ');
  const levelLabel = cachedLabel('');
  const bestLabel = cachedLabel('Best ');
  const timeLabel = cachedLabel('');

  function resize() {
    const ratio = window.devicePixelRatio || 1;
    const width = Math.round(window.innerWidth * ratio);
    const height = Math.round(window.innerHeight * ratio);
    canvas.width = width;
    canvas.height = height;
    view.scale = Math.min(width / FIELD.width, height / FIELD.height);
    view.x = (width - FIELD.width * view.scale) / 2;
    view.y = (height - FIELD.height * view.scale) / 2;
  }

  const fonts = new Map();
  function text(value, x, y, size, color, align) {
    if (!fonts.has(size)) fonts.set(size, `${size}px ${FONT}`);
    context.font = fonts.get(size);
    context.fillStyle = color;
    context.textAlign = align;
    context.fillText(value, x, y);
  }

  function drawFloor(level) {
    for (let row = 0; row < 18; row += 1) {
      for (let col = 0; col < 32; col += 1) {
        const tile = level.grid[row][col];
        const x = col * TILE;
        const y = row * TILE;
        if (tile === TILE_WALL) {
          context.fillStyle = PALETTE.wall;
          context.fillRect(x, y, TILE, TILE);
          context.fillStyle = PALETTE.wallTop;
          context.fillRect(x, y, TILE, 4);
          continue;
        }
        context.fillStyle = (row + col) % 2 === 0 ? PALETTE.floorA : PALETTE.floorB;
        context.fillRect(x, y, TILE, TILE);
        if (tile === TILE_DARK) {
          context.fillStyle = PALETTE.floorDark;
          context.fillRect(x, y, TILE, TILE);
        }
        context.fillStyle = PALETTE.grout;
        context.fillRect(x, y + TILE - 1, TILE, 1);
        context.fillRect(x + TILE - 1, y, 1, TILE);
      }
    }
    // Lamp pools: warm light spilling across the floorboards.
    for (const lamp of level.lamps) {
      const gradient = context.createRadialGradient(lamp.x, lamp.y, 8, lamp.x, lamp.y, 110);
      gradient.addColorStop(0, 'rgba(255,184,77,0.34)');
      gradient.addColorStop(0.55, 'rgba(255,184,77,0.12)');
      gradient.addColorStop(1, 'rgba(255,184,77,0)');
      context.fillStyle = gradient;
      context.fillRect(lamp.x - 110, lamp.y - 110, 220, 220);
      context.fillStyle = PALETTE.lampCore;
      context.beginPath();
      context.arc(lamp.x, lamp.y, 6, 0, Math.PI * 2);
      context.fill();
      context.strokeStyle = PALETTE.lampGlow;
      context.lineWidth = 2;
      context.beginPath();
      context.arc(lamp.x, lamp.y, 11, 0, Math.PI * 2);
      context.stroke();
    }
  }

  function drawCover(level) {
    for (let row = 0; row < 18; row += 1) {
      for (let col = 0; col < 32; col += 1) {
        if (level.grid[row][col] !== TILE_COVER) continue;
        const x = col * TILE;
        const y = row * TILE;
        // Alternate crates and glass display cases, by tile parity.
        if ((row + col) % 2 === 0) {
          context.fillStyle = PALETTE.crate;
          context.fillRect(x + 3, y + 3, TILE - 6, TILE - 6);
          context.strokeStyle = PALETTE.crateEdge;
          context.lineWidth = 2;
          context.strokeRect(x + 3, y + 3, TILE - 6, TILE - 6);
          context.beginPath();
          context.moveTo(x + 3, y + 3);
          context.lineTo(x + TILE - 3, y + TILE - 3);
          context.moveTo(x + TILE - 3, y + 3);
          context.lineTo(x + 3, y + TILE - 3);
          context.stroke();
        } else {
          context.fillStyle = PALETTE.caseGlass;
          context.fillRect(x + 3, y + 3, TILE - 6, TILE - 6);
          context.strokeStyle = PALETTE.caseGold;
          context.lineWidth = 2;
          context.strokeRect(x + 3, y + 3, TILE - 6, TILE - 6);
          context.fillStyle = 'rgba(255,255,255,0.14)';
          context.fillRect(x + 8, y + 6, 8, TILE - 12);
        }
      }
    }
  }

  function drawArtifacts(level) {
    level.artifacts.forEach((artifact, index) => {
      if (artifact.taken) return;
      const colour = ARTIFACT_COLOURS[index % ARTIFACT_COLOURS.length];
      const glow = context.createRadialGradient(artifact.x, artifact.y, 2, artifact.x, artifact.y, 34);
      glow.addColorStop(0, colour + '55');
      glow.addColorStop(1, colour + '00');
      context.fillStyle = glow;
      context.fillRect(artifact.x - 34, artifact.y - 34, 68, 68);
      context.fillStyle = '#3a3348';
      context.fillRect(artifact.x - 11, artifact.y - 4, 22, 14);
      context.fillStyle = colour;
      context.beginPath();
      context.moveTo(artifact.x, artifact.y - 16);
      context.lineTo(artifact.x + 9, artifact.y - 5);
      context.lineTo(artifact.x, artifact.y + 4);
      context.lineTo(artifact.x - 9, artifact.y - 5);
      context.closePath();
      context.fill();
      context.fillStyle = 'rgba(255,255,255,0.75)';
      context.beginPath();
      context.moveTo(artifact.x - 3, artifact.y - 13);
      context.lineTo(artifact.x + 1, artifact.y - 6);
      context.lineTo(artifact.x - 4, artifact.y - 5);
      context.closePath();
      context.fill();
    });
  }

  function drawExit(level, open) {
    const exit = level.exit;
    const colour = open ? PALETTE.exitOn : PALETTE.exitOff;
    const glow = context.createRadialGradient(exit.x, exit.y, 4, exit.x, exit.y, 52);
    glow.addColorStop(0, colour + '66');
    glow.addColorStop(1, colour + '00');
    context.fillStyle = glow;
    context.fillRect(exit.x - 52, exit.y - 52, 104, 104);
    context.fillStyle = '#101018';
    context.fillRect(exit.x - 16, exit.y - 18, 32, 36);
    context.strokeStyle = colour;
    context.lineWidth = 3;
    context.strokeRect(exit.x - 16, exit.y - 18, 32, 36);
    context.fillStyle = colour;
    context.font = `bold 11px ${FONT}`;
    context.textAlign = 'center';
    context.fillText(open ? 'EXIT' : 'LOCKED', exit.x, exit.y + 30);
  }

  function drawCones(guards) {
    for (const guard of guards) {
      const state = guard.state;
      const base =
        state.mode === GUARD_ALERT
          ? PALETTE.coneAlert
          : state.mode === GUARD_SUSPICIOUS || state.mode === GUARD_SEARCH
            ? PALETTE.coneSuspect
            : PALETTE.coneCalm;
      const alpha = state.mode === GUARD_ALERT ? 0.34 : state.suspicion > 0.05 ? 0.3 : 0.2;
      const gradient = context.createRadialGradient(state.x, state.y, 10, state.x, state.y, state.cone);
      gradient.addColorStop(0, `rgba(${base},${alpha})`);
      gradient.addColorStop(1, `rgba(${base},0)`);
      context.fillStyle = gradient;
      context.beginPath();
      context.moveTo(state.x, state.y);
      context.arc(state.x, state.y, state.cone, state.facing - CONE_HALF, state.facing + CONE_HALF);
      context.closePath();
      context.fill();
    }
  }

  function drawPlayer(player) {
    const { x, y, radius, facing, sneaking, stepPhase } = player;
    const bob = Math.sin(stepPhase) * 1.5;
    const alpha = sneaking ? 0.82 : 1;
    context.save();
    context.globalAlpha = alpha;
    // Cloak: a hooded triangle with a pale mask of a face.
    context.fillStyle = PALETTE.player;
    context.beginPath();
    context.moveTo(x + Math.cos(facing) * (radius + 4), y + Math.sin(facing) * (radius + 4));
    context.arc(x, y, radius, facing + 2.2, facing - 2.2);
    context.closePath();
    context.fill();
    context.strokeStyle = PALETTE.playerTrim;
    context.lineWidth = 2;
    context.beginPath();
    context.arc(x, y, radius, facing + 2.2, facing - 2.2);
    context.stroke();
    context.fillStyle = PALETTE.playerTrim;
    context.beginPath();
    context.arc(x + Math.cos(facing) * 5, y + Math.sin(facing) * 5 + bob * 0.3, 4.5, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = '#101018';
    context.beginPath();
    context.arc(x + Math.cos(facing) * 6.5, y + Math.sin(facing) * 6.5 - 1.5, 1.1, 0, Math.PI * 2);
    context.arc(x + Math.cos(facing) * 6.5, y + Math.sin(facing) * 6.5 + 1.5, 1.1, 0, Math.PI * 2);
    context.fill();
    context.restore();
  }

  function drawGuards(guards) {
    for (const guard of guards) {
      const state = guard.state;
      const bob = Math.sin(state.stepPhase) * 1.2;
      context.fillStyle = PALETTE.guard;
      context.beginPath();
      context.arc(state.x, state.y + bob * 0.3, state.radius, 0, Math.PI * 2);
      context.fill();
      context.strokeStyle = PALETTE.guardTrim;
      context.lineWidth = 2;
      context.beginPath();
      context.arc(state.x, state.y + bob * 0.3, state.radius, 0, Math.PI * 2);
      context.stroke();
      // Cap brim in the facing direction.
      context.fillStyle = PALETTE.guardCap;
      context.beginPath();
      context.arc(state.x + Math.cos(state.facing) * 8, state.y + Math.sin(state.facing) * 8, 5, 0, Math.PI * 2);
      context.fill();
      // Suspicion arc above the guard's head.
      if (state.suspicion > 0.05) {
        context.strokeStyle = state.mode === GUARD_ALERT ? PALETTE.danger : PALETTE.warn;
        context.lineWidth = 3;
        context.beginPath();
        context.arc(state.x, state.y, state.radius + 7, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * state.suspicion);
        context.stroke();
      }
      if (state.mode === GUARD_ALERT) {
        text('!', state.x, state.y - state.radius - 12, 22, PALETTE.danger, 'center');
      } else if (state.mode === GUARD_SUSPICIOUS || state.mode === GUARD_SEARCH) {
        text('?', state.x, state.y - state.radius - 12, 20, PALETTE.warn, 'center');
      }
    }
  }

  function drawHud(world) {
    const level = world.level;
    context.textBaseline = 'top';
    text(levelLabel(level.def.name), 24, 18, 24, PALETTE.text, 'left');
    text(`Artifacts ${world.artifactsTaken}/${world.artifactsTotal}`, 24, 48, 18, PALETTE.muted, 'left');
    // Exposure bar, centre top: how seen you are right now.
    const barWidth = 220;
    const barX = (FIELD.width - barWidth) / 2;
    context.fillStyle = '#101018';
    context.fillRect(barX - 2, 18, barWidth + 4, 22);
    context.fillStyle = world.exposure > 0.66 ? PALETTE.danger : world.exposure > 0.33 ? PALETTE.warn : '#3d4a2e';
    context.fillRect(barX, 20, barWidth * Math.min(1, world.exposure), 18);
    context.strokeStyle = PALETTE.muted;
    context.lineWidth = 1;
    context.strokeRect(barX - 2, 18, barWidth + 4, 22);
    text('SEEN', barX + barWidth / 2, 44, 14, PALETTE.muted, 'center');
    text(scoreLabel(world.score), FIELD.width - 24, 18, 24, PALETTE.text, 'right');
    text(timeLabel(formatTime(world.elapsed)), FIELD.width - 24, 48, 18, PALETTE.muted, 'right');
    // Lives as little masks, under the score.
    for (let life = 0; life < LIVES; life += 1) {
      const x = FIELD.width - 24 - life * 26;
      context.fillStyle = life < world.lives ? PALETTE.playerTrim : '#2a2a33';
      context.beginPath();
      context.arc(x, 88, 8, 0, Math.PI * 2);
      context.fill();
    }
    // Contextual hint along the bottom.
    let hint = 'WASD / arrows — move    Shift — sneak (slow, quiet, harder to spot)    Q — toss a coin to lure a guard    P — pause    M — mute';
    if (world.exposure > 0.66) hint = 'SPOTTED — break line of sight, hide in shadow!';
    else if (world.exposure > 0.33) hint = 'A guard is getting suspicious — slip away.';
    else if (world.coins && world.coins.ringing()) hint = 'The coin rang — a guard is coming to look!';
    else if (!world.exitOpen) hint = `Take every artifact (${world.artifactsTaken}/${world.artifactsTotal}), then reach the glowing exit.`;
    else hint = 'The exit is open — get out, unseen!';
    text(hint, FIELD.width / 2, FIELD.height - 30, 16, world.exposure > 0.33 ? PALETTE.warn : PALETTE.muted, 'center');
  }

  function drawPanel(title, lines, prompt, accent) {
    const height = PANEL.top + lines.length * PANEL.line + PANEL.bottom;
    const x = (FIELD.width - PANEL.width) / 2;
    const y = (FIELD.height - height) / 2;
    context.fillStyle = 'rgba(10,10,16,0.82)';
    context.fillRect(x, y, PANEL.width, height);
    context.strokeStyle = accent || PALETTE.caseGold;
    context.lineWidth = 2;
    context.strokeRect(x, y, PANEL.width, height);
    context.textBaseline = 'alphabetic';
    text(title, FIELD.width / 2, y + 72, 44, PALETTE.text, 'center');
    for (let index = 0; index < lines.length; index += 1) {
      text(lines[index], FIELD.width / 2, y + PANEL.top + index * PANEL.line, 20, PALETTE.muted, 'center');
    }
    text(prompt, FIELD.width / 2, y + height - 38, 22, PALETTE.artifactGold, 'center');
  }

  const TITLE_LINES = [
    'A museum after closing. Four wings to empty. One way out.',
    'Guards patrol with lamps and cones of sight —',
    'stay in shadow, move slow, and never let them see you twice.',
    'WASD / arrows to move · Shift to sneak · Q to toss a coin · P to pause · M to mute',
    '',
    'Four wings: The Foyer · The Gallery · The Vault Wing · The Cellar',
  ];
  const PAUSED_LINES = ['The guards will wait for you.'];
  const CAUGHT_LINES = ['', ''];
  const OVER_LINES = ['', ''];
  const LEVEL_LINES = ['', '', ''];
  const WIN_LINES = ['', '', ''];

  /** Paint one frame: the floor, the cones, the people, then the HUD or a panel. */
  function draw(world, screen, best) {
    const level = world.level;
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.fillStyle = PALETTE.backdrop;
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.setTransform(view.scale, 0, 0, view.scale, view.x, view.y);
    drawFloor(level);
    drawExit(level, world.exitOpen);
    drawArtifacts(level);
    drawCover(level);
    drawCones(world.guards);
    drawLighting(context, level);
    drawPlayer(world.player.state);
    drawGuards(world.guards);
    drawCoins(context, world.coins);
    drawNearMiss(context, world.exposure);
    if (screen === SCREEN_TITLE) {
      TITLE_LINES[4] = bestLabel(best);
      drawPanel('LAMPLIGHT HEIST', TITLE_LINES, 'Press Space or click to begin');
      return;
    }
    drawHud(world);
    if (screen === SCREEN_PAUSED) {
      drawPanel('Paused', PAUSED_LINES, 'Press P to resume');
    } else if (screen === SCREEN_LEVEL) {
      LEVEL_LINES[0] = `Cleared ${world.clearedName} — score ${world.score}.`;
      LEVEL_LINES[1] = world.clearedGhost ? 'Never spotted. Ghost bonus earned.' : 'Spotted along the way.';
      LEVEL_LINES[2] = `Next: ${world.level.def.name}.`;
      drawPanel('Clean getaway', LEVEL_LINES, 'Press Space for the next wing');
    } else if (screen === SCREEN_CAUGHT) {
      CAUGHT_LINES[0] = `Caught in ${level.def.name}.`;
      CAUGHT_LINES[1] = world.lives === 1 ? 'One life left.' : `${world.lives} lives left.`;
      drawPanel('Caught!', CAUGHT_LINES, 'Press Space to try the wing again', PALETTE.danger);
    } else if (screen === SCREEN_OVER) {
      OVER_LINES[0] = `Score ${world.score}.`;
      OVER_LINES[1] = bestLabel(best);
      drawPanel('The night ends here', OVER_LINES, 'Press Space to start over', PALETTE.danger);
    } else if (screen === SCREEN_WIN) {
      WIN_LINES[0] = `Every artifact lifted. Final score ${world.score}.`;
      WIN_LINES[1] = `Finished in ${formatTime(world.totalElapsed)}.`;
      WIN_LINES[2] = bestLabel(best);
      drawPanel('The vault is empty', WIN_LINES, 'Press Space to play again');
    }
  }

  resize();
  window.addEventListener('resize', resize);
  return { draw };
}
