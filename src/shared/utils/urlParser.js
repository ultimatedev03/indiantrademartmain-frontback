
import { locationService } from '@/shared/services/locationService';

// Hardcoded for synchronous parsing when needed, though typically we'd fetch from DB.
// In a real app, this might be generated at build time or cached.
const KNOWN_STATES = [
    { name: 'Andhra Pradesh', slug: 'andhra-pradesh' },
    { name: 'Arunachal Pradesh', slug: 'arunachal-pradesh' },
    { name: 'Assam', slug: 'assam' },
    { name: 'Bihar', slug: 'bihar' },
    { name: 'Chhattisgarh', slug: 'chhattisgarh' },
    { name: 'Goa', slug: 'goa' },
    { name: 'Gujarat', slug: 'gujarat' },
    { name: 'Haryana', slug: 'haryana' },
    { name: 'Himachal Pradesh', slug: 'himachal-pradesh' },
    { name: 'Jharkhand', slug: 'jharkhand' },
    { name: 'Karnataka', slug: 'karnataka' },
    { name: 'Kerala', slug: 'kerala' },
    { name: 'Madhya Pradesh', slug: 'madhya-pradesh' },
    { name: 'Maharashtra', slug: 'maharashtra' },
    { name: 'Manipur', slug: 'manipur' },
    { name: 'Meghalaya', slug: 'meghalaya' },
    { name: 'Mizoram', slug: 'mizoram' },
    { name: 'Nagaland', slug: 'nagaland' },
    { name: 'Odisha', slug: 'odisha' },
    { name: 'Punjab', slug: 'punjab' },
    { name: 'Rajasthan', slug: 'rajasthan' },
    { name: 'Sikkim', slug: 'sikkim' },
    { name: 'Tamil Nadu', slug: 'tamil-nadu' },
    { name: 'Telangana', slug: 'telangana' },
    { name: 'Tripura', slug: 'tripura' },
    { name: 'Uttar Pradesh', slug: 'uttar-pradesh' },
    { name: 'Uttarakhand', slug: 'uttarakhand' },
    { name: 'West Bengal', slug: 'west-bengal' },
    { name: 'Delhi', slug: 'delhi' },
    { name: 'Chandigarh', slug: 'chandigarh' },
    { name: 'Jammu and Kashmir', slug: 'jammu-and-kashmir' },
    { name: 'Ladakh', slug: 'ladakh' },
    { name: 'Puducherry', slug: 'puducherry' }
];

// Sort by length desc to match longest slugs first (e.g. "andhra-pradesh" vs "pradesh" if that was a state)
const SORTED_STATES = KNOWN_STATES.sort((a, b) => b.slug.length - a.slug.length);

export const urlParser = {
    /**
     * Parses a slug like "geotechnical-investigation-services-in-visakhapatnam-andhra-pradesh"
     * Returns { serviceSlug, citySlug, stateSlug }
     */
    parseSeoSlug: (fullSlug) => {
        if (!fullSlug || typeof fullSlug !== 'string') return null;

        // Split by the specific delimiter '-in-'
        // Note: Use lastIndexOf to handle cases where service name might contain '-in-' (though rare/bad practice)
        // Better: Split by ' -in- ' if we had spaces, but slugs don't.
        // We assume the structure [service]-in-[city]-[state]
        
        const delimiter = '-in-';
        const parts = fullSlug.split(delimiter);

        if (parts.length < 2) {
            // No delimiter found, return as just service/category
            return { serviceSlug: fullSlug, citySlug: null, stateSlug: null };
        }

        // Service is everything before the last occurrence of the delimiter (in case service name has it)
        // But for safety, let's assume standard format: service is parts[0], location is parts[1]
        // If there are multiple '-in-', we usually take the last one as the separator.
        
        let serviceSlug = parts[0];
        let locationPart = parts.slice(1).join(delimiter); // Rejoin rest if split multiple times

        // If split resulted in > 2 parts due to multiple 'in', usually the last 'in' separates location.
        // e.g. "check-in-services-in-delhi". 
        // Logic: find last index of '-in-'
        const lastIndex = fullSlug.lastIndexOf(delimiter);
        if (lastIndex !== -1) {
             serviceSlug = fullSlug.substring(0, lastIndex);
             locationPart = fullSlug.substring(lastIndex + delimiter.length);
        }

        // Now parse locationPart: "visakhapatnam-andhra-pradesh"
        // We check if it ends with a known state slug
        let stateSlug = null;
        let citySlug = null;

        for (const state of SORTED_STATES) {
            if (locationPart.endsWith(state.slug)) {
                stateSlug = state.slug;
                // City is the part before state, minus the trailing hyphen
                // "visakhapatnam-andhra-pradesh" -> remove "andhra-pradesh" -> "visakhapatnam-"
                const cityPart = locationPart.slice(0, -(state.slug.length));
                if (cityPart.endsWith('-')) {
                    citySlug = cityPart.slice(0, -1);
                } else if (cityPart === '') {
                     // Case: "in-delhi" (where city matches state or implied)
                     citySlug = null; 
                } else {
                     // Could be edge case where city name is merged?
                     citySlug = cityPart; 
                }
                break;
            }
        }

        // Fallback: If no state matched, maybe the whole location part is a state (e.g. "in-delhi")
        if (!stateSlug) {
            const exactState = SORTED_STATES.find(s => s.slug === locationPart);
            if (exactState) {
                stateSlug = exactState.slug;
                citySlug = null; // No city specified
            } else {
                // Unknown location structure, treat as city only? Or just fail gracefully.
                // Let's assume it's just a city if no state matches? Or just a state?
                // For now, return what we found.
                citySlug = locationPart; 
            }
        }

        return { serviceSlug, citySlug, stateSlug };
    },

    /**
     * Constructs SEO URL from parts
     */
    createSeoUrl: (serviceSlug, stateSlug, citySlug) => {
        let url = `/directory/${serviceSlug}`;
        if (stateSlug && citySlug) {
            url += `-in-${citySlug}-${stateSlug}`;
        } else if (stateSlug) {
            // Fallback to structured if only state? Or SEO format?
            // "service-in-state"
            url += `-in-${stateSlug}`;
        }
        return url;
    },
    
    /**
     * Constructs Structured URL from parts
     */
    createStructuredUrl: (serviceSlug, stateSlug, citySlug) => {
        let url = `/directory/${serviceSlug}`;
        if (stateSlug) url += `/${stateSlug}`;
        if (citySlug) url += `/${citySlug}`;
        return url;
    }
};
