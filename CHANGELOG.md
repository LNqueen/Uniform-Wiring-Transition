# Changelog

## [1.2.0] - 2026-01-26

### Added
- **Arc Support**: Supports creating transitions between straight tracks (`Track`) and arcs (`ArcTrack/Arc`).
- **Smart Multi-Selection**: Box select multiple segments. The plugin uses a **Dangling Endpoint** algorithm:
    1. Identifies endpoints not connected to any other selected segment.
    2. Finds the closest pair among these dangling endpoints.
    3. Creates the transition between them.
- **Connection Info Display**: The input dialog now shows exact coordinates and distance between the connection points.

### Fixed
- **Arc Width Scaling**: Arc width is now correctly read (requires x10 scaling from API).
- **Arc Coordinate Handling**: Arc coordinates no longer incorrectly scaled (API returns correct units).
- **Stability**: Replaced complex curve transitions with robust linear stepped transitions.

## [1.1.0] - 2026-01-13

### Changed
- **Removed Single-Line Mode**: To reduce confusion, the "extend from single line" mode has been removed. The plugin now strictly requires two tracks to be selected.
- **Optimized Interaction**:
    - Automatically detects the closest endpoints between two selected tracks, removing the need for manual endpoint selection.
    - Combined the transition confirmation with the segment count input for a faster workflow.
- **UI Improvements**: Added unit switching (mm/mil) via the menu.

### Added
- **Unit Toggle**: Users can now switch between mm and mil units from the menu.
- **Segment Count Input**: Users can now specify the exact number of segments for the transition.

## [1.0.0] - 2026-01-12

### Added
- Initial release.
- Basic stepped transition functionality.
- Support for extending a single track (deprecated in v1.1.0).
- Support for connecting two tracks.
