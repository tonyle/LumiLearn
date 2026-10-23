# Upgrade Math Meadow Run into Pokémon Ultimate Math Race

You are working inside my existing LumiLearn Home repository.

**IMPORTANT: This prompt supersedes the previous racing behavior. AI Pokémon MUST continue racing in real time while the student is thinking. Do not pause the race between questions.**

## Project
- Next.js 16.4.2, React 19, TypeScript, PostgreSQL, Zod, Sharp, Vitest.
- Local self-hosted learning platform used by three children on iPads.
- Upgrade the existing **Math Meadow Run** game IN PLACE.
- Preserve its existing routes/navigation where possible, student authentication, question generation, answer validation, and rewards.
- Do not create a duplicate game or rebuild unrelated systems.

## Game concept

Rename Math Meadow Run to **Pokémon Ultimate Math Race**.

Four Pokémon compete on a beautiful, animated fantasy race track.

The student selects one of five Pokémon:
- Pikachu — Thunderbolt, golden electricity.
- Charizard — Flamethrower, blazing fire.
- Blastoise — Hydro Pump, powerful water.
- Venusaur — Solar Beam, glowing leaves and green energy.
- Lucario — Aura Sphere, blue energy.

Each race has one student Pokémon and three distinct AI Pokémon.

All racers move continuously in real time.

The student's Pokémon runs at a moderate base speed even while the student is thinking.

AI Pokémon also continue moving while the student is answering.

Correct answers activate a spectacular elemental special move and a temporary speed boost.

Fast correct answers grant stronger boosts than slow correct answers, but slow correct answers still give meaningful progress.

Wrong answers do not grant special-move boosts.

The game should be exciting, competitive, visually impressive, and fair for children.

## Critical racing mechanics

Implement a frame-rate-independent racing simulation using elapsed time in seconds.

Use requestAnimationFrame for visual updates and delta-time-based movement.

Store logical race positions and velocities separately from React rendering.

Do not increment React state on every animation frame unnecessarily.

Use configurable race parameters:
- Race distance.
- Player base speed.
- AI base speeds.
- AI speed variance.
- Correct-answer boost.
- Response-time bonus.
- Consecutive-answer combo.
- Catch-up assistance.
- Maximum AI lead.
- Maximum acceleration.
- Finish-line behavior.

Suggested initial tuning:
- 10 questions per race.
- Target duration: approximately 90–150 seconds for a typical student, not a hard time limit.
- AI speeds vary slightly so overtaking occurs naturally.
- Player base speed is slightly lower than a normal AI racer.
- Correct answers produce significant temporary boosts.
- Fast correct answers earn additional acceleration.
- Three correct answers in a row activate a stronger combo.
- Slow but correct answers must still provide a satisfying special move and boost.

## Dynamic race balancing

Use a subtle rubber-band racing system.

Goals:
1. The player should feel that opponents can catch up and overtake.
2. Opponents must never race so fast that the student has no realistic chance.
3. The player must not be left hopelessly behind after thinking carefully.
4. Opponents should not artificially teleport backward or stop abruptly.
5. Correct answers must always matter more than random AI behavior.
6. A student who answers all 10 questions correctly should have a high probability of winning, ideally around 85–95% across representative simulation tests.
7. Students who make several mistakes can still lose.
8. A very fast, accurate student should generally win more comfortably than a slower student with equal accuracy.

Use smooth bounded speed adjustments rather than directly changing racer positions.

Near the end, keep the race close but allow the student to win decisively after a strong final-answer boost.

Do not guarantee first place regardless of performance.

## Prevent premature race completion

AI racers must not finish the race while the student is still on question 3 or 4 under normal conditions.

Design the race so:
- AI progress is paced against expected question completion.
- The final stretch remains competitive.
- Racers can approach the finish line while questions are ongoing.
- If the student is unusually slow, the game still reaches a fair conclusion without trapping AI at an invisible wall indefinitely.
- Define clear finish and loss conditions.
- Never fake the displayed positions.

Use simulation tests for fast, average, slow, and highly inaccurate students.

## Special moves — MOST IMPORTANT VISUAL FEATURE

Every correct answer MUST trigger the selected Pokémon's signature move.

### Pikachu — Thunderbolt
- Bright golden lightning.
- Electric arcs around the body.
- A lightning bolt shoots forward.
- Yellow speed streaks.
- Energetic acceleration.

### Charizard — Flamethrower
- Fiery orange-red burst.
- Flame particles and glowing embers.
- Wings spread or body tilts forward.
- Blazing speed trail.

### Blastoise — Hydro Pump
- Two powerful cyan water jets.
- Splash and droplet particles.
- Blue shockwave.
- Water-propelled acceleration.

### Venusaur — Solar Beam
- Bright green energy charge.
- A glowing solar beam.
- Leaves, petals, and green sparkles.
- Nature-themed speed trail.

### Lucario — Aura Sphere
- Glowing blue energy sphere.
- Expanding Aura rings.
- Blue particle explosion.
- Fast blue motion streaks.

Each correct-answer sequence:
1. Answer confirmation.
2. Pokémon briefly charges its elemental energy.
3. Signature move fires.
4. The Pokémon accelerates dramatically.
5. The Pokémon visibly gains ground or overtakes an opponent when its position allows.
6. Speed boost gradually returns to normal.

Aim for approximately 0.8–1.4 seconds of major visual effects without blocking gameplay.

For a three-answer streak, add a more spectacular combo effect.

Special moves are visual speed boosts only; do not damage or stun opponents.

## Visual quality

Create a premium colorful fantasy racing game, not a plain educational quiz.

Include:
- Four beautiful horizontal racing lanes.
- Large recognizable Pokémon artwork.
- Parallax fantasy meadow environment.
- Animated trees, grass, flowers, clouds, and distant mountains.
- Smooth character movement and ground shadows.
- Continuous running or floating animation.
- Speed lines and elemental trails.
- A clear finish line.
- Camera emphasis during special moves.
- Animated ranking indicators.
- Attractive Pokémon selection cards.
- A spectacular podium and victory celebration.

Use CSS, SVG, React, and local image assets.

Avoid heavy 3D engines and unnecessary dependencies.

Optimize for landscape iPad Safari.

Respect prefers-reduced-motion and provide a way to reduce flashes and camera shake.

## Artwork

I have no image files prepared.

Automatically download artwork for Pokémon IDs:
- Pikachu: 25
- Charizard: 6
- Blastoise: 9
- Venusaur: 3
- Lucario: 448

Use:
- https://github.com/PokeAPI/sprites
- https://pokeapi.co/api/v2/
- Optional animated sprites from https://play.pokemonshowdown.com/sprites/

Prefer high-resolution official artwork for character selection and podium screens.

Use appropriate animated sprites in the race if available.

Otherwise animate static artwork with CSS transforms, bouncing, leaning, shadows, and motion effects.

Cache images locally, optimize static assets using Sharp, and never require Internet during gameplay.

Document artwork copyright restrictions and do not assume redistribution rights.

## Math integration

Preserve the existing Math Meadow Run modes:
- Addition and subtraction within 20.
- Multiplication and division tables 1–9.

Reuse the existing question generator and answer checking.

Show questions in a large touch-friendly panel while the race continues visibly in the background.

Measure response time per question using a monotonic clock for gameplay feedback.

Correct answers:
- Trigger special move.
- Award a speed boost.
- Update streak.
- Show encouraging feedback.

Incorrect answers:
- Show supportive feedback.
- Reset or reduce streak.
- No special-move boost.
- Keep the race running.

Do not penalize students with a hard countdown timer.

## Race results and persistence

Show:
- Finishing position.
- Correct answers.
- Accuracy.
- Fastest response.
- Best streak.
- Total race duration.
- Earned rewards.
- Replay button.

Use existing student identity and reward systems.

Keep answer validation and reward awarding server-authoritative.

Prevent duplicate reward submissions and repeated result claims.

Do not let the client submit an arbitrary score for points.

## Testing

Add tests for:
- Frame-rate-independent movement.
- Fast and slow correct-answer boosts.
- Incorrect-answer behavior.
- Combo boosts.
- AI speed boundaries.
- Catch-up behavior.
- Finish-line conditions.
- No duplicate rewards.
- Race simulation with different student performance profiles.

Run representative simulations for:
- 10/10 correct, fast responses.
- 10/10 correct, average responses.
- 10/10 correct, slow responses.
- 7/10 correct.
- 5/10 correct.
- Very slow student.

Tune parameters until races are close and exciting without becoming unfair.

Run lint, typecheck, tests, and build.

## Implementation priorities

P0:
Upgrade the existing Math Meadow Run into a complete real-time Pokémon racing game.

P1:
Add all five special-move animations, polished artwork, speed trails, and premium visual effects.

P2:
Add additional tracks and optional visual customization.

**Do not create a new RPG, PetDex, Pokémon evolution system, shop, or multiplayer service.**

The final game must feel like a thrilling real-time race where every correct math answer unleashes a powerful Pokémon move and gives the student a meaningful opportunity to overtake opponents.