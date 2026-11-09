import SwiftUI

struct AboutView: View {
    @Environment(AppModel.self) private var model

    var body: some View {
        List {
            Section {
                VStack(alignment: .leading, spacing: 8) {
                    Text("KENTUCKY EATS").displayFont(32).foregroundStyle(Theme.green)
                    Text("A free guide to \(model.restaurantCount.formatted()) Kentucky restaurants, led by hand-checked lists of Kentucky's own food: Hot Browns, Kentucky classics from burgoo and mutton to beer cheese and rolled oysters, Bardstown and bourbon country, Covington and Newport, and historic inns and taverns, with James Beard honors. No account, no ads, no tracking.")
                        .font(.subheadline).foregroundStyle(Theme.ink2)
                    Text("Kentucky Eats is an independent app by Nicholas Soderstrom. It is not affiliated with, endorsed by or operated by the Commonwealth of Kentucky, the Kentucky Department for Public Health or any local health department, Louisville Metro Government or Louisville Metro Public Health and Wellness, Kentucky ABC, Custom Data Processing, the Kentucky Department of Tourism or any tourism office, the Kentucky Distillers' Association, the James Beard Foundation, Apple, or any restaurant or chain. Other names are trademarks of their owners.")
                        .font(.footnote).foregroundStyle(Theme.muted)
                }
                .padding(.vertical, 4)
            }
            Section("How the lists are built") {
                Text("Hand-checked lists (Hot Browns, Kentucky classics, Bardstown and bourbon country, Covington and Newport, historic inns and taverns, and the oldest places) include only places checked against a 2025 or 2026 source (a dated news story, or Kentucky's own tourism offices' pages for the place), with the address checked. Founding years mean the year it opened at this address.")
                Text("Honors are James Beard Foundation winners, finalists and semifinalists. No MICHELIN Guide covers Kentucky.")
                Text("Kentucky publishes no statewide open list of its restaurants. This app starts from open map listings (Overture Maps), adds Louisville Metro's permitted restaurants, and keeps the kinds of listing that proved reliable in the states that do publish lists. Whether a place serves alcohol comes from Louisville Metro's ABC licenses and Kentucky ABC's statewide on-premises drink licenses; a place with no matched license shows it as unknown, never no. Adult clubs are left out, and stadium, airport and campus stands are hidden with the non-restaurants. Website links are checked, and any that no longer belong to the place are left out.")
                Text("Kentucky's local and district health departments inspect restaurants under the state's food code: the score is 100 minus the violation points. Louisville Metro publishes its inspections as open data, so places in Jefferson County show their official score and, where Louisville gave one, its own A/B/C grade, as published and dated; this app computes no grade. Elsewhere each county health department posts its latest score, and any follow-up's, on the state's public inspection portal: those show as published and dated too, with a link to the county's table.")
                Text("Ratings, reviews, hours and photos are Apple Maps' own, shown live in Apple's place card. This app doesn't store or rank by them.")
            }
            .font(.subheadline).foregroundStyle(Theme.ink2)
            Section("Sources") {
                source("Louisville Metro Government", "Environmental Health Bulk Data (Establishments, Inspections) from Louisville Metro Public Health and Wellness, and ABC Licenses, from the Louisville Metro Open Data Platform\(model.permitsUpdated.isEmpty ? "" : " (as of \(DayFormat.text(model.permitsUpdated) ?? model.permitsUpdated))"), under the Open Data Commons Public Domain Dedication and License. This app keeps food-service establishments and on-premises alcohol licenses, matches them to map listings, and shows regular, follow-up and complaint inspections that carry a score. In Louisville Metro's words: \"Datasets made available on the LMG ODP are provided for informational purposes. LMG and the publishing entities do not warranty the completeness, accuracy, content, or fitness for any particular purpose or use of any dataset made available on the LMG ODP.\"", "https://louisville-metro-opendata-lojic.hub.arcgis.com/pages/terms-of-use-and-license")
                source("Kentucky public inspection portal", "Each county health department's latest inspection score and any follow-up score, from the portal Custom Data Processing runs for Kentucky's health departments, exported county by county\(model.inspectionsThrough["Kentucky local health department (state public portal)"].flatMap { DayFormat.text($0) }.map { " (inspections through \($0))" } ?? ""). Shown as published, matched to map listings by name and address; Jefferson County comes from Louisville Metro's open data instead.", Links.inspections.absoluteString)
                source("Kentucky Department of Alcoholic Beverage Control", "Active on-premises drink licenses (NQ1, NQ2, NQ3 and NQ4 retail drink, quota retail drink and limited restaurant) from Kentucky ABC's public license lookup, by business name and premises address only.", "https://abcportal.ky.gov/BelleExternal/LicenseLookup/LicenseDetails")
                source("Kentucky tourism offices", "The Kentucky Department of Tourism, Louisville Tourism, Visit Owensboro and meetNKY pages behind the hand-checked lists, each cited in the data.", "https://www.kentuckytourism.com")
                source("Overture Maps Foundation", "Restaurant listings and websites come from Overture Maps Foundation places data (overturemaps.org)\(model.overtureRelease.map { ", release \($0)" } ?? ""), filtered and reformatted for this app.\n• Data from Meta, Microsoft, DAC and BrightQuery. Available under CDLA Permissive 2.0.\n• Data from Foursquare. \(foursquareCopyright) Available under Apache 2.0. Foursquare data was transformed to the Overture schema; this app further filtered and reformatted it. See the NOTICE below.\n• Data from AllThePlaces. Available under CC0 1.0.\nResearched places are put on the map with Overture Maps addresses data (open address sources under permissive licenses, docs.overturemaps.org/attribution).", "https://overturemaps.org")
                source("Honors", "James Beard Foundation awards are reported as facts and checked by hand against the Foundation's announcements. James Beard Foundation and James Beard Award are trademarks of the James Beard Foundation. Kentucky Bourbon Trail is a trademark of the Kentucky Distillers' Association. Other names belong to their owners.", "https://www.jamesbeard.org/awards")
                source("Maps", "Maps, place cards and directions by Apple Maps.", nil)
            }
            Section("Licenses") {
                NavigationLink("Community Data License Agreement – Permissive 2.0") { LicenseText(file: "CDLA-Permissive-2.0", title: "CDLA Permissive 2.0") }
                NavigationLink("Apache License 2.0") { LicenseText(file: "Apache-2.0", title: "Apache License 2.0") }
                NavigationLink("Foursquare OS Places NOTICE") { LicenseText(file: "Foursquare-NOTICE", title: "Foursquare NOTICE") }
            }
            Section("Privacy") {
                Text("The app collects nothing. Your location, if you allow it, only sorts lists by distance and shows where you are on the map, on this device. Saved places stay on this device.")
                    .font(.subheadline).foregroundStyle(Theme.ink2)
                DataUpdatesNote()
                    .font(.footnote).foregroundStyle(Theme.muted)
                Link("Privacy policy", destination: Links.privacy)
                Link("Terms of use", destination: Links.terms)
            }
            Section("Help") {
                Link("Report a missing or closed place", destination: Links.correctionEmail)
                Link("Email \(Links.supportEmail)", destination: URL(string: "mailto:\(Links.supportEmail)")!)
                Link("Website", destination: Links.site)
                Text("Data as of \(DayFormat.text(model.generated) ?? model.generated). Places open and close; check before you go. Version \(Bundle.main.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String ?? "1.0")")
                    .font(.footnote).foregroundStyle(Theme.muted)
            }
        }
        .navigationTitle("About")
        .tint(Theme.green)
    }

    /// the copyright line exactly as the bundled Foursquare NOTICE has it, so the two can't disagree
    private var foursquareCopyright: String {
        guard let url = Bundle.main.url(forResource: "Foursquare-NOTICE", withExtension: "txt"),
              let text = try? String(contentsOf: url, encoding: .utf8),
              let line = text.split(separator: "\n").first(where: { $0.hasPrefix("©") }) else { return "© Foursquare Labs, Inc. All rights reserved." }
        return line.trimmingCharacters(in: .whitespaces)
    }

    @ViewBuilder
    private func source(_ name: String, _ detail: String, _ url: String?) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            if let url, let u = URL(string: url) { Link(name, destination: u).font(.subheadline.weight(.semibold)) }
            else { Text(name).font(.subheadline.weight(.semibold)) }
            Text(detail).font(.caption).foregroundStyle(Theme.muted)
        }
    }
}

/// A bundled license text (Resources/Licenses), reflowed rather than shown as raw 80-column lines.
struct LicenseText: View {
    let file: String
    let title: String

    var body: some View {
        ScrollView {
            Text(text).font(.footnote).foregroundStyle(Theme.ink).textSelection(.enabled)
                .frame(maxWidth: .infinity, alignment: .leading).padding()
        }
        .inlineTitle(title)
    }

    private var text: String {
        guard let url = Bundle.main.url(forResource: file, withExtension: "txt"),
              let raw = try? String(contentsOf: url, encoding: .utf8) else { return "License text missing." }
        // join hard-wrapped lines into paragraphs; keep blank lines and list items as breaks
        var out: [String] = []
        for para in raw.components(separatedBy: "\n\n") {
            let lines = para.components(separatedBy: "\n").map { $0.trimmingCharacters(in: .whitespaces) }
            var joined = ""
            for l in lines where !l.isEmpty {
                let startsItem = l.hasPrefix("–") || l.hasPrefix("-") || l.range(of: #"^\(?[a-z0-9]{1,3}[.)]\s"#, options: .regularExpression) != nil
                joined += joined.isEmpty ? l : (startsItem ? "\n" + l : " " + l)
            }
            if !joined.isEmpty { out.append(joined) }
        }
        return out.joined(separator: "\n\n")
    }
}
