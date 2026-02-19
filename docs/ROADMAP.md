# RITUAL - Project Roadmap & TODOs

## 🔴 Critical / High Priority
**Difficulty: Hard**
- [ ] **Festival Portal Implementation**:
    - Support for "Parent Festival" vs "Editions" (Lolla 2024, Lolla 2023).
    - Database schema update might be needed (or usage of `series` concept).
    - Interactive Lineup Grid.
- [ ] **Import External History**:
    - Strategy for importing from Setlist.fm (Parsing/Scraping or API?).
    - Spotify "Concert History" heuristic algorithm.

**Difficulty: Medium**
- [ ] **Venue Portal**:
    - Google Maps integration (Static Map or Interactive).
    - Venue Stats (Show count, most popular artists).
- [ ] **Manual Event Entry Improvements**:
    - Autocomplete for Artists/Venues in `EventForm`.
    - "Create New" inline modal for missing Artists.

## 🟡 Enhancement / Medium Priority
**Difficulty: Medium**
- [ ] **Social Features**:
    - "Follow" other users.
    - Activity Feed (Friends' attendance).
    - Shared stats (Compatibility score?).
- [ ] **Notifications**:
    - Email/Push for "Upcoming Show tomorrow".
    - "New Tour Announced" for wishlisted artists.

**Difficulty: Easy**
- [ ] **UI Polish**:
    - Dark mode refinement (ensure contrast).
    - Micro-interactions (Heart animation, Loading skeletons).
    - Responsive tweaks for mobile.
- [ ] **SEO & Metadata**:
    - Dynamic `og:image` generation for Events/Artists.
    - JSON-LD Schema markup for Events.

## 🟢 Low Priority / Nice to Have
**Difficulty: Hard**
- [ ] **Mobile App (React Native)**:
    - Port logic to Expo/React Native.
    - Offline support.
- [ ] **Ticketing Integration**:
    - Deep linking to local ticket providers (AllAccess, Passline).

**Difficulty: Easy**
- [ ] **Empty States**:
    - Creative illustrations for empty screens.
- [ ] **Onboarding Tour**:
    - "How to use Ritual" tooltip walkthrough.
