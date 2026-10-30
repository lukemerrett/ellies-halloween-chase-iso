# Ellie's Halloween Chase: the isometric edition

A spooky (but not too spooky) chase game, made for Ellie, drawn in isometric 2D on an HTML5 canvas. Help Matilda get her library books back from the school at midnight, without Miss Trunchbull catching her.

**Play it:** https://lukemerrett.github.io/ellies-halloween-chase-iso/

It's made for a phone held sideways, and it works on a computer too. It's the same game as [Ellie's Halloween Chase](https://github.com/lukemerrett/ellies-halloween-chase), redrawn as a model-village view from above at an angle.

## How to play

- **Walk:** press and drag anywhere on the left of the screen. Matilda walks the way you drag: drag up and she walks up the screen. On a computer, use the arrow keys or WASD.
- **POWER (big purple button):** Matilda's special power.
  - If Miss Trunchbull is close, it knocks her dizzy for a few seconds, and a nearby jug of water (with a newt in it) flies at her.
  - Otherwise it floats crates out of the way. One book in every level is hidden behind a crate.
  - The ring around the button fills up again after each use. On a computer, press Space.
- **Hide:** walk into a wicker basket (they have a glowing green ring). Miss Trunchbull can't see you in there, and Matilda's eyes peek out from under the lid. Press the big green **GET OUT** button when it's safe; it replaces POWER while you're hiding. On a computer, press Space.
- **Books:** collect every glowing book. Then the padlock on the way out turns green.
- **Fairy light:** a little floating light always leads the way to the next book, or to the door.
- **Pumpkins:** walk past a pumpkin to light it. If Miss Trunchbull catches you, you go back to the last lit pumpkin and keep your books.

Miss Trunchbull patrols the level. If she spots you, her eyes glow red, she reaches out to grab you, her face in the top corner turns red, and you'll hear her stomping and your heartbeat. Run, hide or use your POWER.

## Levels

Every time a level starts it gets a new random layout, checked so every book and the door can always be reached.

1. **The Playground at Midnight:** a hedge maze inside iron railings, with 3 books and helpful tips.
2. **The Creaky Corridors:** classrooms and corridors, with 5 books.
3. **The Headmistress's Hall:** 5 books, and once you have them all, Miss Trunchbull gets very angry and chases you to the door.

## Tech

It's a static site with no build step and no libraries:
- Everything is drawn with the Canvas 2D API: the characters, walls, furniture and floors are all paths, gradients and strokes in code. There are no image files.
- Walls, floors and furniture are drawn once into small offscreen canvases and reused. The two characters are drawn fresh every frame so they can walk, reach and blink.
- Objects are sorted back to front each frame. Walls standing in front of Matilda or Miss Trunchbull fade out so they never disappear behind one.
- The darkness is a half-size canvas with soft holes cut out for Matilda's lantern, candles, pumpkins, books and moonlit windows.
- Sounds and music are synthesised with the Web Audio API.

| File | What it holds |
|---|---|
| `index.html` | Page, HUD, touch controls and screens |
| `src/game.js` | Game logic, isometric drawing, lighting, controls, and Miss Trunchbull's patrol and chase |
| `src/characters.js` | Matilda and Miss Trunchbull |
| `src/art.js` | Floors, walls, furniture, baskets, books, pumpkins and other props |
| `src/levels.js` | The random layout generator |
| `src/audio.js` | Sound effects and the spooky drone |

To run it locally, serve the folder with any static web server, for example `python3 -m http.server`, because browsers won't load ES modules from `file://`.

An unofficial fan game made for a family member, not affiliated with the Roald Dahl Story Company. Matilda and Miss Trunchbull are characters created by Roald Dahl. All art here is original.
