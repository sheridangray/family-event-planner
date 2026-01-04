import Foundation

struct RemoteConfig: Codable {
    let minSupportedVersion: String
    let maintenanceMode: Bool
    let featureFlags: [String: Bool]
    let apiBaseUrl: String
    
    enum CodingKeys: String, CodingKey {
        case minSupportedVersion
        case maintenanceMode
        case featureFlags
        case apiBaseUrl
    }
    
    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        minSupportedVersion = try container.decodeIfPresent(String.self, forKey: .minSupportedVersion) ?? "1.0"
        maintenanceMode = try container.decodeIfPresent(Bool.self, forKey: .maintenanceMode) ?? false
        featureFlags = try container.decodeIfPresent([String: Bool].self, forKey: .featureFlags) ?? [:]
        apiBaseUrl = try container.decodeIfPresent(String.self, forKey: .apiBaseUrl) ?? ""
    }
    
    init(minSupportedVersion: String, maintenanceMode: Bool, featureFlags: [String: Bool] = [:], apiBaseUrl: String = "") {
        self.minSupportedVersion = minSupportedVersion
        self.maintenanceMode = maintenanceMode
        self.featureFlags = featureFlags
        self.apiBaseUrl = apiBaseUrl
    }
}

class RemoteConfigService {
    static let shared = RemoteConfigService()
    private let configKey = "cached_remote_config"
    
    private init() {}
    
    func fetchConfig() async throws -> RemoteConfig {
        // Use the centralized base URL from AppConfig
        let urlString = "\(AppConfig.baseURL)/api/app-config"
        guard let url = URL(string: urlString) else {
            throw URLError(.badURL)
        }
        
        do {
            let (data, _) = try await URLSession.shared.data(from: url)
            let response = try JSONDecoder().decode(ConfigResponse.self, from: data)
            
            // Cache successful fetch
            cacheConfig(response.config)
            return response.config
        } catch {
            print("❌ Failed to fetch remote config: \(error.localizedDescription)")
            // Return cached version if network fails
            if let cached = getCachedConfig() {
                print("ℹ️ Using cached remote config")
                return cached
            }
            throw error
        }
    }
    
    private func cacheConfig(_ config: RemoteConfig) {
        if let encoded = try? JSONEncoder().encode(config) {
            UserDefaults.standard.set(encoded, forKey: configKey)
        }
    }
    
    private func getCachedConfig() -> RemoteConfig? {
        guard let data = UserDefaults.standard.data(forKey: configKey) else { return nil }
        return try? JSONDecoder().decode(RemoteConfig.self, from: data)
    }
}

private struct ConfigResponse: Codable {
    let success: Bool
    let config: RemoteConfig
}
