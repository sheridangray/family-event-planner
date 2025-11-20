import Foundation
import Security

/// Helper class for securely storing data in the iOS Keychain
class KeychainHelper {
    
    /// Save data to Keychain
    /// - Parameters:
    ///   - key: Unique identifier for the data
    ///   - data: Data to store
    static func save(key: String, data: Data) {
        let query = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrAccount as String: key,
            kSecValueData as String: data
        ] as [String: Any]
        
        // Delete any existing item
        SecItemDelete(query as CFDictionary)
        
        // Add new item
        let status = SecItemAdd(query as CFDictionary, nil)
        
        if status != errSecSuccess {
            print("❌ Keychain save error: \(status)")
        } else {
            print("✅ Keychain saved: \(key)")
        }
    }
    
    /// Load data from Keychain
    /// - Parameter key: Unique identifier for the data
    /// - Returns: Data if found, nil otherwise
    static func load(key: String) -> Data? {
        let query = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrAccount as String: key,
            kSecReturnData as String: kCFBooleanTrue!,
            kSecMatchLimit as String: kSecMatchLimitOne
        ] as [String: Any]
        
        var dataTypeRef: AnyObject?
        let status = SecItemCopyMatching(query as CFDictionary, &dataTypeRef)
        
        if status == errSecSuccess {
            print("✅ Keychain loaded: \(key)")
            return dataTypeRef as? Data
        }
        
        if status != errSecItemNotFound {
            print("❌ Keychain load error: \(status)")
        }
        
        return nil
    }
    
    /// Delete data from Keychain
    /// - Parameter key: Unique identifier for the data
    static func delete(key: String) {
        let query = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrAccount as String: key
        ] as [String: Any]
        
        let status = SecItemDelete(query as CFDictionary)
        
        if status == errSecSuccess {
            print("✅ Keychain deleted: \(key)")
        } else if status != errSecItemNotFound {
            print("❌ Keychain delete error: \(status)")
        }
    }
}


