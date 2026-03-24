# Finding Communities

Karmyq starts with geography because mutual aid is fundamentally local — the person who can give you a ride or watch your dog is almost certainly nearby. The communities page reflects that by defaulting to a "Near Me" view, while also letting you browse by interest when that's what you're looking for.

---

## Geography Mode (Default)

When you open the communities page, you're in **Near Me** mode. The page requests your location from the browser and sorts communities by distance from you.

Distance is calculated using a Euclidean approximation of the latitude/longitude coordinates stored on each community. This is accurate enough for city-scale sorting — a community 2 km away will rank above one 10 km away — though it's not a precise road-distance calculation.

The distance badge on each community card shows the approximate distance in kilometers.

### If Geolocation Is Denied

If you decline the browser location prompt (or have location blocked in your browser settings):

- The page falls back to **alphabetical listing**
- A notice at the top explains that location is unavailable and lists are in alphabetical order
- You can still browse all communities; you just won't see distance sorting

To restore distance sorting, allow location access in your browser's site settings and refresh the page.

---

## Interest Mode

Sometimes you need a specific kind of help that your local community doesn't cover — or you want to find others who share a niche interest regardless of distance. **By Interest** mode lets you filter by tag.

**To switch to interest mode:**
1. Click the **By Interest** toggle at the top of the communities page
2. Tag chips appear — each represents a category that communities have self-tagged with
3. Click any chip to filter to communities with that tag; click multiple chips to narrow further
4. Communities matching all selected tags are shown, regardless of geography

Admins set their community's tags from the community admin page (Settings tab). Tags are stored lowercase and searched case-insensitively — "Dog Walking" and "dog walking" are the same tag.

---

## Your Discovery Mode Persists

The toggle you choose (Geography or By Interest) is saved in your browser. The next time you open the communities page, you'll return to whichever mode you were using last.

This uses your browser's `localStorage` — it's device-specific and doesn't sync across devices or browsers.

---

## Adding Tags to Your Community (Admins)

If you run a community and want it to appear in interest-based searches:

1. Go to your community page
2. Open the **Settings** tab (visible to community admins)
3. Find the **Location & Discovery** section
4. Add tags that describe your community's focus — e.g., `dog-walking`, `elderly-care`, `tool-sharing`
5. Save

Tags appear as chips on your community's card in interest mode and make your community discoverable to people browsing that interest.
