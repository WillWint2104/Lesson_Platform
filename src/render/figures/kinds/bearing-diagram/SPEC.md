# Figure kind: `bearing-diagram` (specVersion 1)

Authoring spec for lesson-generation. This is a SEALED kind — its specVersion-1
interpretation is permanent (append-only; see CLAUDE.md §g).

## Purpose
Draw labelled points with north arrows and bearing lines between them. Use it for
navigation/bearings questions.

## Data schema (`figure.data`)

| field      | type                                                    | required | notes |
|------------|---------------------------------------------------------|----------|-------|
| `points`   | non-empty array of `{ id:string, x:number, y:number, label?:string }` | **yes** | `id` must be unique; `label` defaults to `id` |
| `bearings` | array of `{ from:string, to:string, degrees:number }`   | no       | `from`/`to` must be existing point `id`s; `degrees` 0–360 |

## Conventions (do not assume otherwise)
- **North is UP.** A north arrow is drawn at every point; bearings are measured
  **clockwise from north**.
- **Three-figure bearings.** Bearing labels are zero-padded to three digits with a
  degree sign — `45` renders as `045°`.
- **Angle as given.** `degrees` is displayed verbatim; the renderer never computes
  the bearing from the point coordinates. Author the coordinates AND the angle
  consistently.

## JSON escaping
`label` may contain math (`$...$`); double all backslashes in JSON
(`"$\\theta$"`, never `"$\theta$"`).

## Complete valid example question
```json
{
  "type": "geometry",
  "prompt": "A buoy $B$ is on a bearing of $037\\degree$ from the harbour $A$. Mark it.",
  "difficulty": "medium",
  "figure": {
    "kind": "bearing-diagram",
    "specVersion": 1,
    "data": {
      "points": [
        { "id": "A", "x": 0, "y": 0, "label": "Harbour" },
        { "id": "B", "x": 3, "y": 4, "label": "Buoy" }
      ],
      "bearings": [{ "from": "A", "to": "B", "degrees": 37 }]
    }
  },
  "answer": "$037\\degree$"
}
```

## Common authoring errors
- Empty `points` → `points: must be a non-empty array of points`.
- Duplicate `id` → `duplicate point id '...'`.
- `bearings[i].from`/`.to` not matching a point `id` → reference error.
- `degrees` outside 0–360 → range error.
- Single-escaped LaTeX in a `label` → control-character load error.
