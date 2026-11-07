import SwiftUI
import UIKit
import CoreText

/// Kentucky palette (provisional, 2026-11-06; Nick decides, playbook/05-naming.md), light only. Loyalties split (UK blue against
/// Louisville red), so the colors come from the state flag and the land (state-prompts/KENTUCKY_PROMPT.md): flag navy #1B365D (12.1:1 on
/// white) for titles, tint and accents; bluegrass green #3D6B4A (white on it 6.2:1) for the hand-checked guide cards; goldenrod
/// #E6A817 only as a pin and card fill under navy text (5.8:1; as text on white it's 2.1:1); barrel amber #9A5B1E (5.4:1) for honors
/// chips; limestone cream #F4EFE4 pages. The names `green`/`gold` are kept from Wisconsin Eats so the shared views read the same; here
/// `green` is flag navy and `gold` is bluegrass green.
enum Theme {
    static let green = Color(hex: 0x1B365D)      // flag navy: titles, tint, primary text accents
    static let green2 = Color(hex: 0x2A4F80)
    static let gold = Color(hex: 0x3D6B4A)       // bluegrass green: card fills under white text, chips
    static let goldSoft = Color(hex: 0xDCE8DF)   // soft bluegrass
    static let lime = Color(hex: 0xE6A817)       // goldenrod, fills only (hand-checked pins, the title shadow), under navy text
    static let limeSoft = Color(hex: 0xFAEBC4)
    static let sand = Color(hex: 0xF4EFE4)       // the Home background, limestone cream
    static let red = Color(hex: 0x9A5B1E)        // honors chips, barrel amber
    static let sandstone = Color(hex: 0x7A4515)  // a darker amber accent (8.0:1 on white)
    static let teal = Color(hex: 0x2B6A73)       // river accent (5.9:1 on white)
    static let ink = Color(hex: 0x1A1A1A)
    static let ink2 = Color(hex: 0x2E3440)
    static let muted = Color(hex: 0x5B6270)
    static let surface = Color.white
    static let surface2 = Color(hex: 0xEEE8DA)
    static let surface3 = Color(hex: 0xE2DACA)
    static let rule = Color(hex: 0xE2DACA)
    static let rule2 = Color(hex: 0xC9BFA9)
}

extension Color {
    init(hex: UInt32) {
        self.init(red: Double((hex >> 16) & 0xFF) / 255, green: Double((hex >> 8) & 0xFF) / 255, blue: Double(hex & 0xFF) / 255)
    }
}

/// A small uppercase label: "STONE CRAB", "1 MICHELIN STAR".
struct Chip: View {
    enum Style { case gold, green, red, plain, dashed }
    let text: String
    var style: Style = .plain

    var body: some View {
        Text(text.uppercased())
            .font(.caption2.weight(.bold))
            .tracking(0.4)
            .padding(.horizontal, 7).padding(.vertical, 3)
            .foregroundStyle(style == .green || style == .red ? Color.white : style == .dashed ? Theme.muted : style == .gold ? Theme.ink : Theme.green)
            .background {
                RoundedRectangle(cornerRadius: 5).fill(style == .gold ? Theme.goldSoft : style == .green ? Theme.green : style == .red ? Theme.red
                                                       : style == .dashed ? .clear : Theme.surface2)
            }
            .overlay {
                if style == .dashed { RoundedRectangle(cornerRadius: 5).strokeBorder(Theme.rule2, style: StrokeStyle(lineWidth: 1, dash: [3, 2])) }
            }
            .accessibilityLabel(text)
    }
}

/// Kentucky Eats' lettering: the system face drawn compressed and heavy for titles and guide names (like a show poster), and the
/// system monospaced face for numbers, dates and small labels. No bundled fonts.
struct DisplayFont: ViewModifier {
    let size: CGFloat
    var weight: Font.Weight = .black
    @ScaledMetric(relativeTo: .body) private var scale: CGFloat = 1

    func body(content: Content) -> some View {
        content.font(.system(size: size * min(scale, 1.6), weight: weight).width(.compressed))
    }
}

/// Numbers, dates and small labels in the system monospaced face, scaled like DisplayFont.
struct MonoFont: ViewModifier {
    let size: CGFloat
    var weight: Font.Weight = .semibold
    @ScaledMetric(relativeTo: .body) private var scale: CGFloat = 1

    func body(content: Content) -> some View {
        content.font(.system(size: size * min(scale, 1.6), weight: weight, design: .monospaced))
    }
}

extension View {
    func displayFont(_ size: CGFloat, weight: Font.Weight = .black) -> some View {
        modifier(DisplayFont(size: size, weight: weight))
    }

    func monoFont(_ size: CGFloat, weight: Font.Weight = .semibold) -> some View {
        modifier(MonoFont(size: size, weight: weight))
    }
}

/// The header band: a black four-plank horse-farm fence over two rolling bluegrass hills, on a navy baseline.
struct Stripes: View {
    var height: CGFloat = 6

    var body: some View {
        Canvas { ctx, size in
            let w = size.width, h = size.height, base = h * 0.80
            // two hills, the far one paler
            for (i, (crest, amp)) in [(0.35, 0.95), (0.75, 0.70)].enumerated() {
                var p = Path()
                p.move(to: CGPoint(x: 0, y: base))
                for k in 0...40 {
                    let x = CGFloat(k) / 40
                    let y = base - base * CGFloat(amp) * (0.55 + 0.45 * cos((x - CGFloat(crest)) * .pi * 1.6))
                    p.addLine(to: CGPoint(x: x * w, y: max(0, y)))
                }
                p.addLine(to: CGPoint(x: w, y: base)); p.closeSubpath()
                ctx.fill(p, with: .color(Theme.gold.opacity([0.45, 1.0][i])))
            }
            // the fence: four rails and a post every 9% of the width
            let top = base * 0.30, railH = max(1, base * 0.07)
            for r in 0..<4 {
                let y = top + CGFloat(r) * (base - top) / 4.2
                ctx.fill(Path(CGRect(x: 0, y: y, width: w, height: railH)), with: .color(Theme.ink))
            }
            var x: CGFloat = w * 0.02
            while x < w {
                ctx.fill(Path(CGRect(x: x, y: top - railH, width: max(2, w * 0.008), height: base - top + railH)), with: .color(Theme.ink))
                x += w * 0.09
            }
            // the navy baseline last
            ctx.fill(Path(CGRect(x: 0, y: base, width: w, height: h - base)), with: .color(Theme.green))
        }
        .frame(height: height * 2.4)
        .clipShape(RoundedRectangle(cornerRadius: 3))
        .accessibilityHidden(true)
    }
}

extension View {
    /// An inline navigation title in the display type. UINavigationBar.appearance() didn't reach every SwiftUI bar on iOS 27
    /// (the Map title went from compressed blue to plain black after a push and pop; place titles were always plain), so the
    /// title is our own view in the bar. The navigation title is still set, for the back button and VoiceOver.
    func inlineTitle(_ title: String) -> some View {
        navigationTitle(title)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .principal) {
                    Text(title).displayFont(19, weight: .heavy).foregroundStyle(Theme.green)
                        .lineLimit(1).minimumScaleFactor(0.7)
                        .accessibilityAddTraits(.isHeader)
                }
            }
    }
}
