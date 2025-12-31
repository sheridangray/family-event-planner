import SwiftUI

/// Conversational AI chat interface for exercise coaching
struct ExerciseChatView: View {
    @EnvironmentObject var exerciseManager: ExerciseManager
    @State private var messages: [ChatMessage] = []
    @State private var inputText: String = ""
    @State private var isLoading: Bool = false
    @State private var conversationId: Int?
    @State private var showingError = false
    @State private var errorMessage = ""
    
    var body: some View {
        VStack(spacing: 0) {
            // Chat messages
            ScrollViewReader { proxy in
                ScrollView {
                    LazyVStack(spacing: 12) {
                        if messages.isEmpty {
                            VStack(spacing: 16) {
                                Image(systemName: "message.fill")
                                    .font(.system(size: 50))
                                    .foregroundStyle(
                                        LinearGradient(
                                            colors: [.sunsetCoral, .sunsetRose],
                                            startPoint: .topLeading,
                                            endPoint: .bottomTrailing
                                        )
                                    )
                                
                                Text("AI Exercise Coach")
                                    .font(.title2)
                                    .fontWeight(.semibold)
                                
                                Text("Ask me about your workouts, get suggestions, or discuss your exercise routine")
                                    .font(.subheadline)
                                    .foregroundColor(.secondary)
                                    .multilineTextAlignment(.center)
                                    .padding(.horizontal)
                            }
                            .padding()
                        } else {
                            ForEach(messages) { message in
                                ChatBubble(message: message)
                                    .id(message.id)
                            }
                        }
                        
                        if isLoading {
                            HStack {
                                ProgressView()
                                Text("AI is thinking...")
                                    .font(.caption)
                                    .foregroundColor(.secondary)
                            }
                            .padding()
                        }
                    }
                    .padding()
                }
                .onChange(of: messages.count) { _ in
                    if let last = messages.last {
                        withAnimation {
                            proxy.scrollTo(last.id, anchor: .bottom)
                        }
                    }
                }
            }
            
            // Input area
            HStack(spacing: 12) {
                TextField("Ask about your workout...", text: $inputText, axis: .vertical)
                    .textFieldStyle(.roundedBorder)
                    .lineLimit(1...4)
                
                Button(action: sendMessage) {
                    Image(systemName: "arrow.up.circle.fill")
                        .font(.title2)
                        .foregroundColor(inputText.isEmpty ? .gray : .sunsetDustyBlue)
                }
                .disabled(inputText.isEmpty || isLoading)
            }
            .padding()
            .background(Color(.systemBackground))
        }
        .alert("Error", isPresented: $showingError) {
            Button("OK", role: .cancel) { }
        } message: {
            Text(errorMessage)
        }
    }
    
    func sendMessage() {
        let userMessageText = inputText
        inputText = ""
        
        // Add user message to UI immediately
        let userMessage = ChatMessage(
            id: messages.count + 1,
            role: "user",
            content: userMessageText,
            createdAt: ISO8601DateFormatter().string(from: Date())
        )
        messages.append(userMessage)
        
        isLoading = true
        
        Task<Void, Never> {
            do {
                guard let token = AuthenticationManager.shared.sessionToken else {
                    throw ExerciseError.notAuthenticated
                }
                
                let url = URL(string: "https://family-event-planner-backend.onrender.com/api/exercise/chat")!
                var request = URLRequest(url: url)
                request.httpMethod = "POST"
                request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
                request.setValue("application/json", forHTTPHeaderField: "Content-Type")
                
                var body: [String: Any] = ["message": userMessageText]
                if let convId = conversationId {
                    body["conversationId"] = convId
                }
                
                request.httpBody = try JSONSerialization.data(withJSONObject: body)
                
                let (data, response) = try await URLSession.shared.data(for: request)
                
                guard let httpResponse = response as? HTTPURLResponse else {
                    throw ExerciseError.serverError("Invalid response")
                }
                
                guard httpResponse.statusCode == 200 else {
                    let errorData = try? JSONSerialization.jsonObject(with: data) as? [String: Any]
                    let errorMsg = errorData?["error"] as? String ?? "Failed to send message"
                    throw ExerciseError.serverError(errorMsg)
                }
                
                let decoder = JSONDecoder()
                let result = try decoder.decode(ExerciseChatResponse.self, from: data)
                
                await MainActor.run {
                    conversationId = result.data.conversationId
                    
                    let assistantMessage = ChatMessage(
                        id: messages.count + 1,
                        role: "assistant",
                        content: result.data.response,
                        createdAt: ISO8601DateFormatter().string(from: Date())
                    )
                    messages.append(assistantMessage)
                    isLoading = false
                }
            } catch {
                await MainActor.run {
                    errorMessage = error.localizedDescription
                    showingError = true
                    isLoading = false
                }
            }
        }
    }
}

// MARK: - Chat Bubble

struct ChatBubble: View {
    let message: ChatMessage
    
    var isUser: Bool {
        message.role == "user"
    }
    
    var body: some View {
        HStack {
            if isUser {
                Spacer()
            }
            
            VStack(alignment: isUser ? .trailing : .leading, spacing: 4) {
                Text(message.content)
                    .padding()
                    .background(
                        RoundedRectangle(cornerRadius: 16)
                            .fill(isUser ? Color.sunsetDustyBlue : Color(.secondarySystemBackground))
                    )
                    .foregroundColor(isUser ? .white : .primary)
                
                Text(formatTime(message.createdAt))
                    .font(.caption2)
                    .foregroundColor(.secondary)
            }
            .frame(maxWidth: UIScreen.main.bounds.width * 0.75, alignment: isUser ? .trailing : .leading)
            
            if !isUser {
                Spacer()
            }
        }
    }
    
    func formatTime(_ dateString: String) -> String {
        let formatter = ISO8601DateFormatter()
        if let date = formatter.date(from: dateString) {
            let timeFormatter = DateFormatter()
            timeFormatter.timeStyle = .short
            return timeFormatter.string(from: date)
        }
        return ""
    }
}

#Preview {
    ExerciseChatView()
        .environmentObject(ExerciseManager.shared)
}

