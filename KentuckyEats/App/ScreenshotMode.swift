import Foundation
import CoreLocation
import UIKit

/// `-screenshot <name>` opens one screen with fixed state for App Store screenshots (scripts/capture-screenshots.sh).
/// Names: home, hotbrown, classics, bourbon, nky, inns, honors, oldest, detail, map, saved, about.
enum ScreenshotMode {
    /// Debug builds only: an App Store build ignores the launch argument, so no one can reach seeded screens or fake locations.
    static var name: String? {
        #if DEBUG
        let args = ProcessInfo.processInfo.arguments
        guard let i = args.firstIndex(of: "-screenshot"), i + 1 < args.count else { return nil }
        return args[i + 1]
        #else
        return nil
        #endif
    }
    static var isActive: Bool { name != nil }

    @MainActor
    static func apply(to model: AppModel) {
        guard let name, model.isLoaded else { return }
        model.filters = Filters()
        // downtown Louisville (Fourth and Broadway, by the Brown Hotel), so "nearest" lists have distances without a permission prompt
        model.screenshotLocation = CLLocation(latitude: 38.2449, longitude: -85.7588)
        // by name and town, ignoring case, so a rebuild with a slightly different casing still finds the place; the hand-checked one first
        let pick = { (n: String, town: String?) -> Place? in
            let hits = model.places.filter { $0.name.caseInsensitiveCompare(n) == .orderedSame && (town == nil || $0.city == town) }
            return hits.first(where: \.handChecked) ?? hits.first
        }
        for p in [pick("Old Talbott Tavern", "Bardstown"), pick("Moonlite Bar-B-Q Inn", "Owensboro"), pick("Beaumont Inn", "Harrodsburg")]
            .compactMap({ $0 }) where !model.isSaved(p) {
            model.toggleSaved(p)
        }
        let open = { (g: Guide) in model.tab = .guides; model.selectedGuide = g; model.guidesPath = [.guide(g)] }
        switch name {
        case "hotbrown": open(.hotbrown)
        case "classics":
            // Owensboro, among the barbecue buffets
            model.screenshotLocation = CLLocation(latitude: 37.7719, longitude: -87.1112)
            open(.classics)
        case "bourbon":
            // Bardstown's Court Square
            model.screenshotLocation = CLLocation(latitude: 37.8092, longitude: -85.4669)
            open(.bourbon)
        case "nky":
            // Covington's MainStrasse Village
            model.screenshotLocation = CLLocation(latitude: 39.0846, longitude: -84.5194)
            open(.nky)
        case "inns": open(.inns)
        case "honors": open(.honors)
        case "oldest": open(.oldest)
        case "detail":
            // the Beaumont Inn: a James Beard America's Classic with its 1919 founding year and its note
            open(.inns)
            if let p = pick("Beaumont Inn", "Harrodsburg") ?? model.places.first {
                model.selectedPlace = p; model.guidesPath.append(.place(p))
            }
        case "map": model.tab = .map
        case "saved": model.tab = .saved
        case "about": model.tab = .about
        default: model.tab = .guides; model.selectedGuide = nil
        }
        // iPad shows the place column next to every list, so give each shot a place instead of "Pick a place": a different
        // honored or hand-checked one per shot.
        guard UIDevice.current.userInterfaceIdiom == .pad, model.selectedPlace == nil else { return }
        let place: Place? = switch name {
        case "home": pick("J Graham's Cafe", "Louisville")
        case "hotbrown": pick("J Graham's Cafe", "Louisville")
        case "classics": pick("Moonlite Bar-B-Q Inn", "Owensboro")
        case "bourbon": pick("Old Talbott Tavern", "Bardstown")
        case "nky": pick("Anchor Grill", "Covington")
        case "inns": pick("Boone Tavern", "Berea")
        case "map": pick("J Graham's Cafe", "Louisville")
        case "honors": pick("Beaumont Inn", "Harrodsburg")
        case "oldest": pick("Old Talbott Tavern", "Bardstown")
        case "saved": pick("Old Talbott Tavern", "Bardstown")
        case "about": nil
        default: pick("Beaumont Inn", "Harrodsburg")
        }
        model.selectedPlace = place
    }
}
