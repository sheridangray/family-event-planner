import SwiftUI

struct GlobalSearchView: View {
    @State private var searchText = ""
    
    var body: some View {
        VStack {
            List {
                Section("Recent Searches") {
                    Text("Salmon recipe")
                    Text("Apollo's birthday")
                    Text("Leg day workout")
                }
                
                Section("Categories") {
                    Label("Time", systemImage: "calendar")
                    Label("Food", systemImage: "fork.knife")
                    Label("Health", systemImage: "heart")
                    Label("Money", systemImage: "banknote")
                }
            }
        }
        .searchable(text: $searchText, prompt: "Search everything...")
    }
}
