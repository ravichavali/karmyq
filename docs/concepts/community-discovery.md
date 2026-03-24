# Community Discovery

Finding the right community is the first step in mutual aid. Karmyq's discovery system is designed around a simple philosophy: start local, then expand by interest.

---

## Geography First

The default discovery mode is **Near Me** — communities sorted by distance from your current location.

This reflects a core belief about mutual aid: the most meaningful exchanges happen between neighbors. The person who can give you a ride, watch your child, or lend you a tool is almost certainly within a few kilometers. Sorting by geography surfaces the communities most likely to contain people who can actually show up.

Distance is calculated using a Euclidean approximation of each community's stored latitude/longitude. For city-scale distances this is accurate enough — the ranking between a community 1 km away and one 8 km away will be correct. It does not account for road networks or terrain.

### When Location Is Unavailable

If you decline the browser location prompt or have location access blocked:
- The page falls back to alphabetical listing
- A notice explains that location is unavailable
- You can still browse and join any community; you just won't see distance-sorted results

Allowing location access (browser site settings → allow location for karmyq.com) restores distance sorting on next page load.

---

## Interest Mode

Geography isn't always the right filter. Some needs are specialized enough that you'd rather find ten people across a city who share your interest than fifty neighbors who don't.

**By Interest** mode lets members filter communities by tags set by their admins. Tag chips appear at the top of the page; clicking one filters to communities tagged with that interest. Multiple chips can be selected to narrow further.

Examples of community tags: `tool-sharing`, `elderly-care`, `dog-walking`, `language-exchange`, `child-care`, `mutual-aid-collective`.

Interest mode is designed for:
- Finding niche communities that may not be in your immediate neighborhood
- Cross-geography connection for specific types of help
- Discovering communities organized around a shared identity or practice rather than a place

---

## How Tags Work

**Admins set tags** for their community from the Settings tab on the community admin page. Tags are free-form text that admins enter to describe their community's focus.

**Tag normalization**: all tags are stored in lowercase and trimmed of whitespace before being saved. Searches are case-insensitive. This means "Dog Walking", "dog-walking", and "DOG WALKING" all resolve to the same tag bucket. Admins should use hyphens to separate multi-word tags for consistency (`tool-sharing` rather than `tool sharing`).

**Tag discovery**: the interest mode chip list is derived from all tags currently in use across active communities. A tag only appears as a chip if at least one community uses it.

---

## Persistence

The discovery mode you choose (Geography or By Interest) is saved to your browser's `localStorage` under the key `community_discovery_mode`. The default is `'geography'`.

This means:
- Your preference persists across page reloads and browser sessions
- It is device-specific and browser-specific — it doesn't sync across devices
- Clearing browser data resets it to the geography default

---

## Why This Design

Most social platforms default to popularity or algorithmic sorting for content discovery. Karmyq defaults to geography for community discovery because:

1. **Proximity is prerequisite for most aid** — physical help requires physical proximity
2. **Local trust is deeper trust** — neighbors who help each other build stronger community bonds than strangers across a city
3. **Interest mode is supplemental, not primary** — specialized connection is valuable, but it works best layered on top of a geography-grounded network, not as a replacement for it

The toggle makes both modes accessible without forcing a choice. Most members will use geography most of the time; interest mode serves the cases where geography isn't enough.
