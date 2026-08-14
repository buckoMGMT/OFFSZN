# Labelled creator VODs

The evaluation set. One JSON file per VOD, each listing the moments a human
would genuinely have posted.

This is the only thing that can tell us whether ClipR picks good clips. Every
accuracy number produced before this existed was circular — moments planted in
a generated file and then "detected", which measures nothing except that the
same code wrote and read the same numbers.

## How to label

Watch the VOD. Mark the moments you would actually have posted — not moments
that are *fine*, moments you would have paid an editor to find.

Give each one a **range** for the start and the end, not a single timestamp.
Two editors will not agree on a frame, and a metric that demands they do is
measuring disagreement rather than quality. The range is "anywhere in here is
an acceptable cut".

Label the VOD **before** looking at what ClipR chose. Labelling afterwards
turns the exercise into agreeing with the machine.

```json
{
  "name": "streamer_a_2024_03_14",
  "media_path": "/absolute/path/to/vod.mp4",
  "duration_seconds": 4820,
  "labels": [
    {
      "start_range": [1245, 1258],
      "end_range": [1280, 1295],
      "quality": 5,
      "category": "reaction",
      "why": "genuine surprise, lands with no setup needed",
      "needs_context": false
    },
    {
      "start_range": [2610, 2622],
      "end_range": [2650, 2664],
      "quality": 3,
      "category": "story",
      "why": "good bit, but only works if you heard the setup",
      "needs_context": true
    }
  ]
}
```

`quality` is 1–5: how much you wanted it. `needs_context` matters because a
clip that requires the previous five minutes is a different failure from a
clip that is simply not interesting, and ClipR scores those separately.

## Then

```bash
make demo INPUT=/path/to/vod.mp4 OUT=evaluation/runs/streamer_a
make eval-clips
```

`eval-clips` reports recall@k, precision@k, boundary error and duplicate rate,
and checks the launch gates. Below twenty VODs it prints the numbers and
declines to call the gate, because at that size the differences are noise.

**Publishable Rate does not come from here.** It comes from creators reviewing
clips in `make review-web`. Deriving it from these labels would make it a
restatement of precision and let the model mark its own homework.

## Target

Ten creators, a hundred VODs, Publishable Rate at or above 70%, under sixty
seconds of review per VOD.
