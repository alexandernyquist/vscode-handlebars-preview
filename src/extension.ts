import {
    workspace, window, commands, ViewColumn,
    ExtensionContext, TextEditorSelectionChangeEvent, TextDocumentChangeEvent, WebviewPanel
} from "vscode";

import { dirname } from "path";
import { existsSync, readFileSync } from "fs";
import * as Handlebars from "handlebars";

// Global state
let panel: WebviewPanel = null;
let closed = false;
let previousFileName = "";
let previousDataFileName = "";

/**
 * Read the contents for the specified file (or document).
 * @param fileName name of file.
 */
const resolveFileOrText = (fileName: string) => {
    let document = workspace.textDocuments.find(e => e.fileName === fileName);

    if (document) {
        return document.getText();
    }

    if (dirname(fileName) && existsSync(fileName)) {
        return readFileSync(fileName, "utf8");
    }
}

/**
 * Compile the provided template source and data.
 * @param templateSource Template source.
 * @param context Template context.
 */
const compileTemplate = (templateSource: string, context: string) => {
    if (!templateSource) {
        return "<body>Select document to render</body>";
    }

    try {   
        let ctx = JSON.parse(context || "{}");
        let template = Handlebars.compile(templateSource);
        return template(ctx);
    } catch (ex) {
        return `
            <body>
                <h2>An Error Occured</h2>
                <pre>${ex}</pre>
            </body>
        `;
    }
}

/**
 * Get the content of the currently open document.
 */
const getContent = () => {
    if (window.activeTextEditor && window.activeTextEditor.document) {
        let currentFileName = window.activeTextEditor.document.fileName;
        let dataFileName: string;
        let fileName: string;

        if (currentFileName === previousFileName || currentFileName === previousDataFileName) {
            // User swtiched editor to context, just use stored on
            fileName = previousFileName;
            dataFileName = previousDataFileName;
        } else {
            dataFileName = currentFileName + ".json";
            fileName = currentFileName;
        }

        previousFileName = fileName;
        previousDataFileName = dataFileName;

        let templateSource = resolveFileOrText(fileName);
        let dataSource = resolveFileOrText(dataFileName);
        return compileTemplate(templateSource, dataSource);
    }

    return "";
}

/**
 * Render the content of the currently open document.
 */
const render = () => {
    if(!panel)  {
        // We do not have a panel, create it
        panel = window.createWebviewPanel(
            "HandlebarsHTMLPreview",
            "Handlebars HTML Preview",
            ViewColumn.Two,
            {}
        );

        // Callback for when the panel is closed
        panel.onDidDispose(() => {
            closed = true;
            panel = null;
        }, null);
    }

    // Set content
    let html = getContent();
    panel.webview.html = html;
}

export function activate(context: ExtensionContext) {
    context.subscriptions.push(
        window.onDidChangeTextEditorSelection((e: TextEditorSelectionChangeEvent) => {
            if (!closed && e.textEditor === window.activeTextEditor) {
                render();
            }
        }),

        workspace.onDidChangeTextDocument((e: TextDocumentChangeEvent) => {
            if (!closed && e.document === window.activeTextEditor.document) {
                render();
            }
        }),

        commands.registerCommand("handlebarsPreview.preview", () => {
            // User triggered the command
            closed = false;
            render();
        })
    );
}

export function deactivate() {
    closed = true;
}