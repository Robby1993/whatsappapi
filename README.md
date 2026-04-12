Remove-Item node_modules -Recurse -Force
Remove-Item package-lock.json
npm install

npm install express cors @whiskeysockets/baileys

node test.js



package com.example.chatbot.templates

// ----------------------
// Template Data Classes
// ----------------------
sealed class TemplateType {
data class Text(val content: String) : TemplateType()
data class Buttons(val content: String, val buttons: List<Button>) : TemplateType()
data class ListTemplate(val content: String, val sections: List<Section>) : TemplateType()
data class Media(val url: String, val caption: String? = null, val mediaType: MediaType) : TemplateType()
}

data class Button(
val id: String,
val displayText: String
)

data class Section(
val title: String,
val rows: List<Row>
)

data class Row(
val id: String,
val title: String,
val description: String? = null
)

enum class MediaType {
IMAGE, VIDEO, DOCUMENT, AUDIO
}

// ----------------------
// Template Manager Class
// ----------------------
class TemplateManager {

    private val templates: MutableMap<String, TemplateType> = mutableMapOf()

    // Add or update template dynamically
    fun addTemplate(keyword: String, template: TemplateType) {
        templates[keyword.lowercase()] = template
    }

    // Remove a template
    fun removeTemplate(keyword: String) {
        templates.remove(keyword.lowercase())
    }

    // Fetch template by keyword
    fun getTemplate(keyword: String): TemplateType? {
        return templates[keyword.lowercase()]
    }

    // List all templates
    fun getAllTemplates(): Map<String, TemplateType> {
        return templates.toMap()
    }

    // Check if template exists
    fun hasTemplate(keyword: String): Boolean {
        return templates.containsKey(keyword.lowercase())
    }
}


fun main() {
val manager = TemplateManager()

    // Add a text template
    manager.addTemplate("hello", TemplateType.Text("Hello! How can I help you?"))

    // Add a buttons template
    manager.addTemplate(
        "options",
        TemplateType.Buttons(
            content = "Choose an option:",
            buttons = listOf(
                Button("help", "Help"),
                Button("info", "Info")
            )
        )
    )

    // Fetch and use template
    val template = manager.getTemplate("options")
    when (template) {
        is TemplateType.Text -> println("Text: ${template.content}")
        is TemplateType.Buttons -> println("Buttons: ${template.buttons.map { it.displayText }}")
        is TemplateType.ListTemplate -> println("List: ${template.sections}")
        is TemplateType.Media -> println("Media URL: ${template.url}")
        null -> println("No template found")
    }
}



brew tap mongodb/brew
brew install mongodb-community
brew services start mongodb-community

ps aux | grep mongod