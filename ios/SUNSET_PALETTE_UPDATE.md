# 🎨 Sunset Color Palette Update

## Overview
Updated the entire iOS app color scheme to match a beautiful sunset-inspired palette with soft peachy pinks, dusty blues, lavenders, and warm golds.

## New Color Definitions

Created `Colors+Sunset.swift` with these custom colors:

### Warm Tones
- **sunsetPeach** - `#FFB6A3` - Soft peachy pink
- **sunsetPeachLight** - `#FFCCC0` - Light peach
- **sunsetCoral** - `#FF8A94` - Warm coral
- **sunsetRose** - `#E17B89` - Rose/dusty rose

### Cool Tones
- **sunsetDustyBlue** - `#7B9FA8` - Dusty blue
- **sunsetDustyBlueDark** - `#5D7A8C` - Dark dusty blue
- **sunsetLavender** - `#B4A7D6` - Soft lavender
- **sunsetPeriwinkle** - `#9B8FC2` - Periwinkle

### Gold Tones
- **sunsetGold** - `#FFCD94` - Warm gold
- **sunsetGoldLight** - `#FFB570` - Light gold

### Dark Tones
- **sunsetSlate** - `#4A5568` - Deep slate
- **sunsetSlateDark** - `#374151` - Darker slate

## Files Updated

### 1. **Colors+Sunset.swift** (NEW)
- Created custom color extension with all sunset palette colors
- Location: `Utilities/Colors+Sunset.swift`

### 2. **HealthCategory.swift**
Updated category gradients:
- **Activity & Fitness**: Dusty blue → Lavender
- **Body Metrics**: Lavender → Peachy pink
- **Heart & Vitals**: Coral → Rose
- **Nutrition**: Warm gold → Light gold
- **Sleep & Recovery**: Deep slate → Dusty blue
- **Mindfulness**: Peachy pink → Lavender

### 3. **SignInView.swift**
- App logo heart icon: Peach → Coral gradient
- Sign-in button: Dusty blue → Dark dusty blue gradient
- Shadow color updated to match

### 4. **HealthSyncView.swift**
- "Sync Now" button: Dusty blue gradient
- "Heart" icon (not connected state): Peach → Coral gradient
- "Connect in Settings" button: Coral → Rose gradient
- All shadow colors updated to match

### 5. **IntegrationsView.swift**
- Apple Health icon: Coral → Rose gradient
- Google Calendar: Dusty blue accent
- Gmail: Coral accent
- "Coming soon" text: Warm gold

### 6. **ProfileMenu.swift**
- Fallback avatar gradient: Dusty blue → Lavender

## Color Philosophy

The new palette provides:
- **Cohesive aesthetic** - all colors from the same natural sunset palette
- **Calming & warm** - softer than bright primary colors
- **Better for health/wellness** - more soothing tones
- **Distinctive categories** - each remains visually unique
- **Light/Dark mode friendly** - muted tones work in both modes

## Usage

All colors are accessible via the `Color` extension:

```swift
// Example usage
.foregroundStyle(
    LinearGradient(
        colors: [.sunsetPeach, .sunsetCoral],
        startPoint: .topLeading,
        endPoint: .bottomTrailing
    )
)
```

## Testing

1. Build the app in Xcode
2. Check all views:
   - Sign-in screen
   - Health dashboard (connected & not connected states)
   - Category cards
   - Settings → Integrations page
   - Profile menu avatar

## Future Additions

Consider using sunset palette for:
- Loading states / progress indicators
- Error/success messages
- Additional integrations
- Charts and graphs (when implemented)

---

**Last Updated**: November 22, 2024
**Designer Inspiration**: Sunset mountain landscape

