import CoreLocation
import Observation
import UIKit

/// "Near me" sorting. Asks for when-in-use permission only when a list is sorted by distance or "My location" is tapped; the location never leaves the device.
@MainActor
@Observable
final class LocationService: NSObject, CLLocationManagerDelegate {
    private let manager = CLLocationManager()
    private(set) var location: CLLocation?
    private(set) var status: CLAuthorizationStatus = .notDetermined
    /// no fix within 12 seconds, or Core Location reported an error
    private(set) var failed = false
    private var timeout: Task<Void, Never>?
    /// when the current request started: a fix from before it is a cached one (from launch, or before a drive) and doesn't count
    private var askedAt = Date.distantPast

    override init() {
        super.init()
        manager.delegate = self
        manager.desiredAccuracy = kCLLocationAccuracyHundredMeters
        status = manager.authorizationStatus
    }

    var isDenied: Bool { status == .denied || status == .restricted }

    /// Every place is in Kentucky, so a reader elsewhere (an App Reviewer in California, say) gets told rather than an empty map.
    /// A coarse outline of the state (Idaho's lesson: a bounding box would count Cincinnati, Evansville and Clarksville),
    /// drawn a little outside the line so the river shores count as inside.
    var isOutsideKentucky: Bool {
        guard let c = location?.coordinate else { return false }
        return !KentuckyOutline.contains(c)
    }

    /// Once location is off for the app, iOS won't ask again; the app's page in Settings is the only way back.
    static func openSettings() {
        if let url = URL(string: UIApplication.openSettingsURLString) { UIApplication.shared.open(url) }
    }

    func request() {
        switch manager.authorizationStatus {
        case .notDetermined: manager.requestWhenInUseAuthorization()
        case .authorizedWhenInUse, .authorizedAlways: locate()
        default: break
        }
    }

    private func locate() {
        failed = false
        let asked = Date()
        askedAt = asked
        manager.requestLocation()
        timeout?.cancel()
        timeout = Task { [weak self] in
            try? await Task.sleep(for: .seconds(12))
            guard let self, !Task.isCancelled else { return }
            if (self.location?.timestamp ?? .distantPast) < asked { self.failed = true }
        }
    }

    nonisolated func locationManagerDidChangeAuthorization(_ m: CLLocationManager) {
        let s = m.authorizationStatus
        Task { @MainActor in
            self.status = s
            if s == .authorizedWhenInUse || s == .authorizedAlways { self.locate() }
        }
    }

    nonisolated func locationManager(_ m: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        guard let l = locations.last else { return }
        Task { @MainActor in
            // "My location" needs a fresh fix on every tap: a cached one from before the request would put you back where you were
            guard l.timestamp >= self.askedAt.addingTimeInterval(-2) else { return }
            self.location = l; self.failed = false; self.timeout?.cancel()
        }
    }

    nonisolated func locationManager(_ m: CLLocationManager, didFailWithError error: Error) {
        Task { @MainActor in if self.location == nil { self.failed = true } }
    }
}

extension CLLocation {
    /// "0.4 mi", "12 mi", "1,012 mi" (an App Reviewer in California is a thousand miles out)
    func milesText(to other: CLLocation) -> String {
        let mi = distance(from: other) / 1609.344
        return (mi < 10 ? mi.formatted(.number.precision(.fractionLength(1))) : Int(mi.rounded()).formatted()) + " mi"
    }
}

/// A coarse Kentucky outline (longitude, latitude), about 400 m outside the Overture land outline but never over a neighbour's land
/// (buffer 0.004°, minus the neighbours buffered 0.0015°, simplify 0.006°; two rings: the mainland and the Kentucky Bend). Louisville,
/// Covington, Newport, Ashland, Paducah, Henderson, Middlesboro, Hopkinsville, Pikeville, Maysville and the Kentucky Bend are inside;
/// Jeffersonville, New Albany and Evansville (Indiana), Cincinnati and Aberdeen (Ohio), Huntington and Williamson (West Virginia),
/// Clarksville, Harrogate and South Fulton (Tennessee), Metropolis (Illinois) and New Madrid (Missouri) are not.
enum KentuckyOutline {
    static let rings: [[(Double, Double)]] = [
        [(-89.416, 36.501), (-89.365, 36.624), (-89.325, 36.63), (-89.273, 36.57), (-89.236, 36.565), (-89.212, 36.579),
         (-89.196, 36.628), (-89.158, 36.666), (-89.169, 36.673), (-89.168, 36.69), (-89.198, 36.717), (-89.198, 36.734),
         (-89.169, 36.758), (-89.126, 36.75), (-89.118, 36.759), (-89.123, 36.787), (-89.17, 36.799), (-89.177, 36.831),
         (-89.137, 36.847), (-89.116, 36.887), (-89.098, 36.961), (-89.114, 36.982), (-89.133, 36.984), (-89.17, 37.009),
         (-89.18, 37.046), (-89.154, 37.088), (-89.11, 37.118), (-89.085, 37.165), (-89.0, 37.223), (-88.931, 37.226),
         (-88.806, 37.187), (-88.733, 37.143), (-88.626, 37.118), (-88.566, 37.074), (-88.49, 37.062), (-88.459, 37.073),
         (-88.423, 37.152), (-88.447, 37.204), (-88.507, 37.261), (-88.514, 37.285), (-88.483, 37.345), (-88.475, 37.386),
         (-88.455, 37.407), (-88.413, 37.423), (-88.365, 37.4), (-88.284, 37.448), (-88.092, 37.47), (-88.071, 37.481),
         (-88.062, 37.516), (-88.132, 37.575), (-88.158, 37.661), (-88.121, 37.709), (-88.059, 37.742), (-88.027, 37.798),
         (-88.002, 37.798), (-87.952, 37.77), (-87.933, 37.795), (-87.906, 37.806), (-87.909, 37.844), (-87.939, 37.88),
         (-87.903, 37.924), (-87.876, 37.922), (-87.83, 37.875), (-87.791, 37.874), (-87.759, 37.89), (-87.676, 37.9),
         (-87.666, 37.888), (-87.683, 37.857), (-87.681, 37.836), (-87.671, 37.827), (-87.644, 37.825), (-87.612, 37.832),
         (-87.583, 37.872), (-87.586, 37.886), (-87.626, 37.921), (-87.597, 37.973), (-87.579, 37.969), (-87.579, 37.951),
         (-87.557, 37.927), (-87.511, 37.905), (-87.449, 37.94), (-87.412, 37.943), (-87.299, 37.895), (-87.222, 37.848),
         (-87.163, 37.839), (-87.132, 37.787), (-87.111, 37.781), (-87.067, 37.805), (-87.042, 37.87), (-87.044, 37.893),
         (-87.033, 37.905), (-86.969, 37.931), (-86.919, 37.935), (-86.855, 37.986), (-86.82, 37.998), (-86.796, 37.988),
         (-86.766, 37.932), (-86.732, 37.893), (-86.718, 37.892), (-86.681, 37.914), (-86.648, 37.908), (-86.663, 37.849),
         (-86.638, 37.841), (-86.597, 37.867), (-86.598, 37.906), (-86.588, 37.92), (-86.534, 37.916), (-86.505, 37.93),
         (-86.524, 37.968), (-86.52, 38.038), (-86.452, 38.049), (-86.43, 38.073), (-86.432, 38.087), (-86.463, 38.102),
         (-86.462, 38.118), (-86.432, 38.125), (-86.401, 38.104), (-86.379, 38.128), (-86.335, 38.128), (-86.322, 38.138),
         (-86.327, 38.158), (-86.372, 38.169), (-86.374, 38.187), (-86.361, 38.195), (-86.289, 38.157), (-86.273, 38.137),
         (-86.28, 38.089), (-86.262, 38.052), (-86.179, 38.01), (-86.123, 38.014), (-86.095, 38.007), (-86.053, 37.961),
         (-86.039, 37.958), (-86.028, 37.992), (-85.947, 38.004), (-85.924, 38.022), (-85.904, 38.09), (-85.905, 38.167),
         (-85.884, 38.198), (-85.842, 38.232), (-85.828, 38.276), (-85.781, 38.287), (-85.742, 38.266), (-85.679, 38.297),
         (-85.65, 38.329), (-85.63, 38.398), (-85.606, 38.438), (-85.499, 38.467), (-85.466, 38.509), (-85.418, 38.534),
         (-85.414, 38.563), (-85.437, 38.605), (-85.437, 38.659), (-85.455, 38.689), (-85.435, 38.727), (-85.415, 38.735),
         (-85.364, 38.729), (-85.277, 38.74), (-85.248, 38.731), (-85.215, 38.695), (-85.173, 38.687), (-84.992, 38.777),
         (-84.941, 38.774), (-84.887, 38.793), (-84.813, 38.784), (-84.828, 38.83), (-84.79, 38.86), (-84.784, 38.88),
         (-84.801, 38.893), (-84.866, 38.9), (-84.876, 38.91), (-84.876, 38.921), (-84.833, 38.958), (-84.829, 38.973),
         (-84.896, 39.056), (-84.832, 39.099), (-84.787, 39.114), (-84.751, 39.146), (-84.719, 39.136), (-84.687, 39.099),
         (-84.619, 39.072), (-84.572, 39.081), (-84.551, 39.098), (-84.511, 39.092), (-84.475, 39.118), (-84.452, 39.117),
         (-84.436, 39.099), (-84.427, 39.052), (-84.341, 39.034), (-84.307, 39.007), (-84.29, 38.955), (-84.235, 38.891),
         (-84.233, 38.832), (-84.214, 38.804), (-84.071, 38.769), (-83.962, 38.786), (-83.874, 38.761), (-83.853, 38.75),
         (-83.837, 38.716), (-83.788, 38.698), (-83.771, 38.654), (-83.669, 38.625), (-83.647, 38.631), (-83.624, 38.678),
         (-83.521, 38.701), (-83.468, 38.674), (-83.359, 38.654), (-83.328, 38.636), (-83.318, 38.607), (-83.299, 38.596),
         (-83.246, 38.627), (-83.203, 38.615), (-83.153, 38.617), (-83.134, 38.631), (-83.111, 38.67), (-83.061, 38.688),
         (-83.027, 38.726), (-82.971, 38.726), (-82.933, 38.746), (-82.887, 38.754), (-82.872, 38.736), (-82.879, 38.688),
         (-82.861, 38.659), (-82.856, 38.613), (-82.843, 38.587), (-82.79, 38.559), (-82.731, 38.558), (-82.701, 38.543),
         (-82.658, 38.496), (-82.615, 38.473), (-82.606, 38.459), (-82.595, 38.422), (-82.599, 38.345), (-82.574, 38.318),
         (-82.585, 38.297), (-82.576, 38.264), (-82.585, 38.248), (-82.605, 38.249), (-82.614, 38.237), (-82.6, 38.217),
         (-82.613, 38.173), (-82.646, 38.165), (-82.638, 38.137), (-82.623, 38.132), (-82.62, 38.119), (-82.589, 38.108),
         (-82.585, 38.09), (-82.552, 38.069), (-82.518, 38.0), (-82.489, 37.997), (-82.485, 37.983), (-82.466, 37.983),
         (-82.485, 37.972), (-82.485, 37.963), (-82.474, 37.959), (-82.499, 37.946), (-82.491, 37.938), (-82.502, 37.937),
         (-82.501, 37.928), (-82.482, 37.925), (-82.49, 37.918), (-82.477, 37.911), (-82.475, 37.899), (-82.464, 37.913),
         (-82.421, 37.883), (-82.41, 37.867), (-82.426, 37.861), (-82.417, 37.855), (-82.421, 37.846), (-82.401, 37.829),
         (-82.403, 37.809), (-82.387, 37.817), (-82.378, 37.802), (-82.341, 37.785), (-82.338, 37.774), (-82.325, 37.774),
         (-82.332, 37.762), (-82.313, 37.763), (-82.335, 37.743), (-82.298, 37.702), (-82.305, 37.675), (-82.288, 37.667),
         (-82.283, 37.674), (-82.257, 37.655), (-82.24, 37.66), (-82.218, 37.64), (-82.214, 37.624), (-82.187, 37.626),
         (-82.19, 37.644), (-82.176, 37.647), (-82.183, 37.621), (-82.166, 37.619), (-82.17, 37.609), (-82.158, 37.608),
         (-82.157, 37.591), (-82.129, 37.586), (-82.128, 37.574), (-82.146, 37.569), (-82.134, 37.552), (-82.075, 37.554),
         (-82.065, 37.535), (-82.047, 37.527), (-82.042, 37.547), (-82.012, 37.532), (-81.998, 37.542), (-81.966, 37.543),
         (-82.326, 37.284), (-82.345, 37.282), (-82.351, 37.269), (-82.499, 37.228), (-82.634, 37.156), (-82.722, 37.122),
         (-82.724, 37.046), (-82.744, 37.044), (-82.749, 37.025), (-82.76, 37.029), (-82.783, 37.009), (-82.829, 37.007),
         (-82.838, 36.989), (-82.868, 36.979), (-82.859, 36.929), (-82.879, 36.909), (-82.87, 36.9), (-82.88, 36.891),
         (-83.008, 36.849), (-83.026, 36.857), (-83.073, 36.856), (-83.076, 36.842), (-83.103, 36.829), (-83.106, 36.805),
         (-83.134, 36.785), (-83.129, 36.761), (-83.136, 36.744), (-83.195, 36.741), (-83.31, 36.712), (-83.425, 36.669),
         (-83.53, 36.668), (-83.578, 36.643), (-83.649, 36.624), (-83.691, 36.584), (-84.543, 36.598), (-85.195, 36.627),
         (-85.488, 36.616), (-85.678, 36.62), (-86.508, 36.654), (-86.551, 36.646), (-86.564, 36.635), (-86.59, 36.654),
         (-87.852, 36.637), (-87.85, 36.667), (-88.071, 36.68), (-88.034, 36.541), (-88.039, 36.514), (-88.054, 36.499),
         (-89.301, 36.509), (-89.416, 36.501)],
        [(-89.542, 36.506), (-89.57, 36.548), (-89.562, 36.568), (-89.528, 36.579), (-89.48, 36.567), (-89.467, 36.53),
         (-89.486, 36.499), (-89.542, 36.506)]]

    static func contains(_ c: CLLocationCoordinate2D) -> Bool { rings.contains { contains(c, ring: $0) } }

    /// Ray casting: a point is inside when a ray east of it crosses the outline an odd number of times.
    static func contains(_ c: CLLocationCoordinate2D, ring: [(Double, Double)]) -> Bool {
        var inside = false
        var j = ring.count - 1
        for i in 0..<ring.count {
            let (xi, yi) = ring[i], (xj, yj) = ring[j]
            if (yi > c.latitude) != (yj > c.latitude) && c.longitude < (xj - xi) * (c.latitude - yi) / (yj - yi) + xi { inside.toggle() }
            j = i
        }
        return inside
    }
}
