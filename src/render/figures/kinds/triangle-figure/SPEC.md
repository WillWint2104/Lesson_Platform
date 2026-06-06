# Figure kind: `triangle-figure` (specVersion 1)

Authoring spec for lesson-generation. This is a SEALED kind — its specVersion-1
interpretation is permanent (append-only; see CLAUDE.md §g).

## Purpose
Draw a single triangle with optional vertex labels, side/length labels, and a
right-angle mark. Use it for triangle geometry questions (areas, Pythagoras,
trigonometry set-ups).

## Data schema (`figure.data`)
| field          | type                                   | required | notes |
|----------------|----------------------------------------|----------|-------|
| `vertices`     | array of exactly 3 `{ x:number, y:number }` | **yes** | the three corners, in order |
| `labels`       | array of exactly 3 strings             | no       | one per vertex, same order as `vertices` |
| `sideLabels`   | array of exactly 3 strings             | no       | side *i* is between `vertices[i]` and `vertices[(i+1)%3]` |
| `rightAngleAt` | integer `0`–`2`                        | no       | index of the vertex carrying a right-angle mark |

## Conventions (do not assume otherwise)
- **No orientation assumptions.** Vertices are rendered AS GIVEN, fitted into the
  canvas with a y-up projection (positive `y` points up). Do not rely on the
  triangle being "flat on the bottom" or any particular rotation.
- **Lengths as given.** `sideLabels` are literal display text — the renderer
  never computes or verifies them. If you write `"5 cm"`, that is what shows.
- An empty string in `labels`/`sideLabels` means "no label for that vertex/side".

## JSON escaping
Labels may contain math (`$...$`). Backslash commands must be **doubled** in JSON:
write `"$\\sqrt{2}$"`, not `"$\sqrt{2}$"` (an un-doubled backslash is a load
error).

## Complete valid example question
```json
{
  "type": "geometry",
  "prompt": "Find the area of triangle $ABC$.",
  "difficulty": "medium",
  "figure": {
    "kind": "triangle-figure",
    "specVersion": 1,
    "data": {
      "vertices": [{ "x": 0, "y": 0 }, { "x": 4, "y": 0 }, { "x": 0, "y": 3 }],
      "labels": ["A", "B", "C"],
      "sideLabels": ["", "5 cm", ""],
      "rightAngleAt": 0
    }
  },
  "answer": "$6\\,\\text{cm}^2$"
}
```

## Common authoring errors
- Fewer or more than 3 `vertices` → `vertices: must be an array of exactly 3 points`.
- `labels`/`sideLabels` not length-3 → exact-length error.
- `rightAngleAt` out of range → must be `0`, `1`, or `2`.
- Single-escaped LaTeX in a label → control-character load error.
