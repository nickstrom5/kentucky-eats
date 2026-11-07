import Foundation
import CoreLocation

/// The lists the app is built around. Each is a filter plus an order; none uses ratings (the app only publishes data it may).
enum Guide: String, CaseIterable, Identifiable, Hashable {
    case hotbrown, classics, bourbon, nky, inns, honors, oldest, nearMe, all

    var id: String { rawValue }

    var title: String {
        switch self {
        case .hotbrown: "Hot Browns"
        case .classics: "Kentucky Classics"
        case .bourbon: "Bardstown & Bourbon Country"
        case .nky: "Covington & Newport"
        case .inns: "Historic Inns & Taverns"
        case .honors: "James Beard Honors"
        case .oldest: "Oldest Places"
        case .nearMe: "Near Me"
        case .all: "All Restaurants"
        }
    }

    /// A shorter navigation-bar title where the full one truncates (iPad's list column fits about 19 characters; sc-eats' finding).
    var navTitle: String {
        switch self {
        case .classics: "Kentucky Classics"
        case .bourbon: "Bourbon Country"
        case .nky: "Covington & Newport"
        case .inns: "Historic Inns"
        case .honors: "Honors"
        default: title
        }
    }

    var subtitle: String {
        switch self {
        case .hotbrown: "Hand-checked Hot Browns, from the Brown Hotel to Frankfort"
        case .classics: "Hand-checked burgoo, mutton, beer cheese, rolled oysters and spoonbread"
        case .bourbon: "Hand-checked tables in Bardstown, the bourbon capital"
        case .nky: "Hand-checked goetta, German beer halls and river-town dining"
        case .inns: "Hand-checked inns and taverns, from 1779 to the Beaumont Inn"
        case .honors: "James Beard Foundation honorees"
        case .oldest: "Founding years checked at the same address, oldest first"
        case .nearMe: "Everything around you, closest first"
        case .all: "Restaurants, cafés, bars and bakeries statewide"
        }
    }

    var systemImage: String {
        switch self {
        case .hotbrown: "frying.pan"
        case .classics: "fork.knife.circle"
        case .bourbon: "wineglass"
        case .nky: "building.columns"
        case .inns: "house.lodge"
        case .honors: "star.circle"
        case .oldest: "clock.arrow.circlepath"
        case .nearMe: "location"
        case .all: "fork.knife"
        }
    }

    /// The hand-checked Kentucky guides get the bluegrass card on Home.
    var isLocalGuide: Bool { tag != nil }

    /// Guides whose order is a ranking worth numbering.
    var isRanked: Bool { [.oldest].contains(self) }

    var sortOptions: [SortOrder] {
        switch self {
        case .hotbrown, .classics, .bourbon, .nky, .inns: [.featured, .nearest, .name]
        case .honors: [.iconic, .nearest]
        case .oldest: [.oldest]
        case .nearMe: [.nearest]
        case .all: [.name, .nearest]
        }
    }

    var defaultSort: SortOrder { sortOptions[0] }

    /// The tag behind a hand-checked guide.
    var tag: PlaceTags? {
        switch self {
        case .hotbrown: .hotbrown
        case .classics: .classics
        case .bourbon: .bourbon
        case .nky: .nky
        case .inns: .inns
        default: nil
        }
    }

    func includes(_ p: Place) -> Bool {
        if let tag {   // the guides that promise "hand-checked" list only places checked open with a 2025–26 source
            return p.handChecked && p.tags.contains(tag)
        }
        switch self {
        case .honors: return p.michelin != .none || p.jamesBeard != nil
        case .oldest: return p.founded != nil && p.tags.contains(.oldest)
        default: return true
        }
    }
}

enum SortOrder: String, CaseIterable, Identifiable {
    case featured, nearest, oldest, name, iconic
    var id: String { rawValue }
    var label: String {
        switch self {
        case .featured: "Featured first"
        case .nearest: "Nearest"
        case .oldest: "Oldest first"
        case .name: "A to Z"
        case .iconic: "James Beard honors first"
        }
    }
}

/// Filters shared by every list. Search text lives with each list.
struct Filters: Equatable, Codable {
    var town: String?
    var cuisine: String?
    var hideChains = false
    var confirmedOnly = false
    var includeNonRestaurants = false
    var bibGourmand = false          // MICHELIN Bib Gourmand only: a fact from the Guide, not a rating

    var activeCount: Int {
        [town != nil, cuisine != nil, hideChains, confirmedOnly, includeNonRestaurants, bibGourmand].filter { $0 }.count
    }

    func allows(_ p: Place) -> Bool {
        if !includeNonRestaurants && p.isVenue { return false }
        if let town, p.city != town { return false }
        if let cuisine, p.cuisine != cuisine { return false }
        if hideChains && p.isChain { return false }
        if confirmedOnly && p.tier == .listing { return false }
        if bibGourmand && p.michelin != .bib { return false }
        return true
    }
}

extension Filters {
    /// Filters saved by an older build have no bibGourmand key: read what's there instead of dropping them all.
    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        self.init(town: try c.decodeIfPresent(String.self, forKey: .town),
                  cuisine: try c.decodeIfPresent(String.self, forKey: .cuisine),
                  hideChains: try c.decodeIfPresent(Bool.self, forKey: .hideChains) ?? false,
                  confirmedOnly: try c.decodeIfPresent(Bool.self, forKey: .confirmedOnly) ?? false,
                  includeNonRestaurants: try c.decodeIfPresent(Bool.self, forKey: .includeNonRestaurants) ?? false,
                  bibGourmand: try c.decodeIfPresent(Bool.self, forKey: .bibGourmand) ?? false)
    }
}

enum Ranking {
    static func sort(_ places: [Place], by order: SortOrder, from here: CLLocation?) -> [Place] {
        // Keys come from fields made once at load: a localized compare, or a new CLLocation per comparison, made a 16,000-place
        // sort take most of a second (AR-13). sortKey is the normalized name, so case, accents and punctuation don't change the order.
        func name(_ a: Place, _ b: Place) -> Bool { a.sortKey != b.sortKey ? a.sortKey < b.sortKey : a.id < b.id }
        switch order {
        case .nearest where here != nil:
            // each distance once, not four times per comparison
            let from = here!
            return places.map { p in (p, p.location.map { $0.distance(from: from) } ?? .greatestFiniteMagnitude) }
                .sorted { $0.1 != $1.1 ? $0.1 < $1.1 : name($0.0, $1.0) }
                .map(\.0)
        case .featured, .nearest:
            // honored places first, then verified founding year, then name
            return places.sorted {
                let a = $0.iconicPoints ?? -1, b = $1.iconicPoints ?? -1
                if a != b { return a > b }
                let fa = $0.founded ?? 9999, fb = $1.founded ?? 9999
                return fa != fb ? fa < fb : name($0, $1)
            }
        case .oldest:
            return places.sorted { ($0.founded ?? 9999) != ($1.founded ?? 9999) ? ($0.founded ?? 9999) < ($1.founded ?? 9999) : name($0, $1) }
        case .name:
            return places.sorted(by: name)
        case .iconic:
            // an order anyone can check: MICHELIN distinction, then the James Beard honor (America's Classic, winner, finalist, semifinalist), then name
            func jb(_ p: Place) -> Int { p.honorFlags & 1 != 0 ? 4 : p.honorFlags & 2 != 0 ? 3 : p.honorFlags & 4 != 0 ? 2 : p.honorFlags & 8 != 0 ? 1 : 0 }
            return places.sorted {
                if $0.michelin.rawValue != $1.michelin.rawValue { return $0.michelin.rawValue > $1.michelin.rawValue }
                if jb($0) != jb($1) { return jb($0) > jb($1) }
                return name($0, $1)
            }
        }
    }
}
