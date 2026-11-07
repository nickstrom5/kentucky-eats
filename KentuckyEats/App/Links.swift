import Foundation

/// The app's web pages and support address, in one place.
/// The site is GitHub Pages at the project address until kentucky.eatsranked.com resolves (Nick adds a Cloudflare CNAME
/// kentucky -> nickstrom5.github.io, DNS only; then scripts/make-site.py sets CUSTOM_DOMAIN). GitHub forwards these github.io
/// links to the custom domain after the switch, so a shipped build keeps working; point them at the new domain in the next update.
enum Links {
    static let site = URL(string: "https://nickstrom5.github.io/kentucky-eats/")!
    /// The app's data updates: scripts/publish_app_data.py writes docs/data/app/ (OTA-DATA.md).
    static let appData = URL(string: site.absoluteString + "data/app/")!
    static let privacy = URL(string: site.absoluteString + "privacy.html")!
    static let terms = URL(string: site.absoluteString + "terms.html")!
    /// Kentucky ABC: it licenses the bars and restaurants that pour alcohol (its BELLE licensee lookup isn't used here: no posted terms)
    static let licenses = URL(string: "https://abc.ky.gov/")!
    /// Kentucky's statewide public inspection portal (Custom Data Processing), one table per county: linked, never read
    static let inspections = URL(string: "https://public.cdpehs.com/KYEnvPBL/VW_PUBLIC_EST_INSP/ShowVW_PUBLIC_EST_INSPTable.aspx")!
    /// Louisville Metro Public Health and Wellness's food safety page (its scores and grades are also open data)
    static let louisvilleInspections = URL(string: "https://louisvilleky.gov/government/health-wellness/food-safety")!
    /// Louisville Metro's open data platform, where the inspection, establishment and ABC license feeds are published (PDDL)
    static let louisvilleData = URL(string: "https://data.louisvilleky.gov/")!

    /// Kentucky's 120 counties in the portal's own order (alphabetical, Adair 1 … Fayette 34 … Woodford 120)
    static let portalCounties: [String] = ["Adair", "Allen", "Anderson", "Ballard", "Barren", "Bath", "Bell", "Boone", "Bourbon", "Boyd", "Boyle", "Bracken", "Breathitt", "Breckinridge", "Bullitt", "Butler", "Caldwell", "Calloway", "Campbell", "Carlisle", "Carroll", "Carter", "Casey", "Christian", "Clark", "Clay", "Clinton", "Crittenden", "Cumberland", "Daviess", "Edmonson", "Elliott", "Estill", "Fayette", "Fleming", "Floyd", "Franklin", "Fulton", "Gallatin", "Garrard", "Grant", "Graves", "Grayson", "Green", "Greenup", "Hancock", "Hardin", "Harlan", "Harrison", "Hart", "Henderson", "Henry", "Hickman", "Hopkins", "Jackson", "Jefferson", "Jessamine", "Johnson", "Kenton", "Knott", "Knox", "Larue", "Laurel", "Lawrence", "Lee", "Leslie", "Letcher", "Lewis", "Lincoln", "Livingston", "Logan", "Lyon", "Madison", "Magoffin", "Marion", "Marshall", "Martin", "Mason", "McCracken", "McCreary", "McLean", "Meade", "Menifee", "Mercer", "Metcalfe", "Monroe", "Montgomery", "Morgan", "Muhlenberg", "Nelson", "Nicholas", "Ohio", "Oldham", "Owen", "Owsley", "Pendleton", "Perry", "Pike", "Powell", "Pulaski", "Robertson", "Rockcastle", "Rowan", "Russell", "Scott", "Shelby", "Simpson", "Spencer", "Taylor", "Todd", "Trigg", "Trimble", "Union", "Warren", "Washington", "Wayne", "Webster", "Whitley", "Wolfe", "Woodford"]

    /// The statewide portal's table for the place's county ("Fayette County" -> COUNTY=34), else the portal itself
    static func countyInspections(_ county: String?) -> URL {
        guard let c = county?.replacingOccurrences(of: " County", with: ""), let i = portalCounties.firstIndex(of: c),
              let u = URL(string: inspections.absoluteString + "?COUNTY=\(i + 1)") else { return inspections }
        return u
    }
    static let supportEmail = "nick@eatsranked.com"

    static var correctionEmail: URL {
        URL(string: "mailto:\(supportEmail)?subject=Kentucky%20Eats%20correction")!
    }

    // MARK: Share

    /// The web app. It opens a place's panel from the hash, explore/#p=<id> (readHash in scripts/explore.js), using the app's ids.
    static let explore = URL(string: site.absoluteString + "explore/")!

    /// What Share sends: the place's own page in the web app, never an Apple Maps or Google link (Apple Maps has its own button).
    /// The id is escaped the way the page's encodeURIComponent would escape it. The web app lists every place
    /// the app does (a unit test checks the ids against docs/data).
    /// The web app lists restaurants only: the venues the app hides by default (stadium stands, gas-station counters) aren't there.
    static func onWeb(_ place: Place) -> Bool { !place.isVenue }
    static func share(_ place: Place) -> URL {
        guard onWeb(place), let id = place.id.addingPercentEncoding(withAllowedCharacters: uriComponent),
              let url = URL(string: explore.absoluteString + "#p=" + id) else { return explore }
        return url
    }

    /// The text that goes with the link: the place, its town and the app. No street address, which Messages turns into a Maps link.
    static func shareMessage(_ place: Place) -> String {
        [place.name, place.city ?? ""].filter { !$0.isEmpty }.joined(separator: ", ") + ", on Kentucky Eats"
    }

    /// What encodeURIComponent leaves as is.
    private static let uriComponent = CharacterSet(charactersIn: "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_.!~*'()")
}
