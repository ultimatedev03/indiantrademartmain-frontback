# URL Parser Update - Database-Driven State Management

## Overview
Updated the URL parser system to fetch states from the database instead of using hardcoded data. This ensures the system automatically stays in sync with the database state list.

## Files Modified

### 1. `/src/shared/utils/urlParser.js`
**Changes:**
- Removed hardcoded `KNOWN_STATES` array
- Added `fetchStatesFromDB()` function that queries Supabase `states` table
- Implemented caching mechanism to avoid repeated database calls
- Made `parseSeoSlug()` function async to fetch states from DB
- Updated state filtering to use database data sorted by slug length

**Key Features:**
- Automatic state list sync with database
- Single request caching to optimize performance
- Error handling for database failures
- Sorts states by slug length for accurate URL parsing

### 2. `/src/modules/directory/pages/SearchResults.jsx`
**Changes:**
- Updated `useEffect` that parses URL slugs to handle async `parseSeoSlug()`
- Wrapped slug parsing in `parseUrl()` async function
- Added null safety checks for parsed results

**Implementation:**
```javascript
useEffect(() => {
  const parseUrl = async () => {
    // ... parsing logic
    const parsed = await urlParser.parseSeoSlug(params.slug);
    // ... rest of logic
  };
  parseUrl();
}, [params, location.pathname]);
```

## How It Works

1. **First Load**: App calls `parseSeoSlug()` which triggers `fetchStatesFromDB()`
2. **Database Query**: Fetches active states from `states` table
3. **Caching**: Results cached in module-level variable `STATES_CACHE`
4. **Subsequent Calls**: Returns cached data without database hit
5. **URL Parsing**: Uses database-sourced state list to parse slugs

## Benefits

✅ **Dynamic**: Automatically reflects changes to states in database
✅ **Performant**: Caching prevents repeated DB queries
✅ **Reliable**: Fetches actual data instead of hardcoded fallbacks
✅ **Scalable**: Works with any number of states/cities
✅ **Maintainable**: No need to update code when adding states

## Database Requirements

The `states` table must have:
- `id` (UUID)
- `name` (text)
- `slug` (text)
- `is_active` (boolean) - only fetches active states

## Testing Checklist

- [ ] SEO URLs parse correctly (e.g., `product-in-delhi-andhra-pradesh`)
- [ ] Structured URLs work (e.g., `/directory/search/product/delhi/andhra-pradesh`)
- [ ] New states added to DB automatically appear in URL parsing
- [ ] Caching works (second request uses cached data)
- [ ] Error handling works if DB fails (graceful fallback)
