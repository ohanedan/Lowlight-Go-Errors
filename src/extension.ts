import * as vscode from 'vscode';

export function activate(context: vscode.ExtensionContext) {
	let opacityType: string;
	let decoration: vscode.TextEditorDecorationType | undefined;
	let decorationKey: string | undefined;
	let lastRanges: vscode.Range[] = [];

	var timeout: ReturnType<typeof setTimeout> | undefined;

	// When `force` is set we drop the cached ranges so the next pass always
	// re-applies the decorations (used on editor switches and opacity changes).
	function triggerLowlight(force: boolean = false) {
		if (timeout) {
			clearTimeout(timeout);
		}
		if (force) {
			lastRanges = [];
		}
		timeout = setTimeout(updateDecorations, 200);
	}

	function updateDecorations() {
		const editor = vscode.window.activeTextEditor;
		if (!editor) {
			return;
		}

		const workbenchConfig = vscode.workspace.getConfiguration();
		if (!workbenchConfig.get<boolean>('lowlightgoerrors.Enabled')) {
			if (decoration) {
				editor.setDecorations(decoration, []);
			}
			lastRanges = [];
			return;
		}

		const opacity = getOpacity(opacityType);
		if (!opacity) {
			return;
		}

		let color: string | undefined;
		if (workbenchConfig.get<boolean>('lowlightgoerrors.ChangeColor')) {
			color = workbenchConfig.get<string>('lowlightgoerrors.Color');
			if (!color?.match("^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$")) {
				vscode.window.showWarningMessage("lowlightgoerrors.Color is not a color code");
			}
		}

		// Only (re)create the decoration type when its visual options actually
		// change. Reusing the same type lets setDecorations update atomically,
		// which avoids the flicker caused by disposing and recreating it.
		const key = opacity + "|" + (color ?? "");
		if (key !== decorationKey) {
			if (decoration) {
				decoration.dispose();
			}
			const options: vscode.DecorationRenderOptions = {
				opacity: opacity,
				rangeBehavior: vscode.DecorationRangeBehavior.ClosedClosed,
			};
			if (color) {
				options.color = color;
			}
			decoration = vscode.window.createTextEditorDecorationType(options);
			decorationKey = key;
			lastRanges = [];
		}

		const ranges = computeRanges(editor, workbenchConfig);

		// Most edits leave the highlighted blocks untouched (VS Code shifts the
		// existing ranges automatically). Skip the update when nothing changed
		// so we never repaint identical decorations.
		if (rangesEqual(ranges, lastRanges)) {
			return;
		}
		editor.setDecorations(decoration!, ranges);
		lastRanges = ranges;
	}

	if (vscode.window.activeTextEditor) {
		triggerLowlight(true);
	}

	vscode.window.onDidChangeActiveTextEditor(editor => {
		if (!editor) {
			return;
		}
		triggerLowlight(true);
	}, null, context.subscriptions);

	vscode.workspace.onDidChangeTextDocument(event => {
		var activeEditor = vscode.window.activeTextEditor;
		if (activeEditor && event.document === activeEditor.document) {
			triggerLowlight();
		}
	}, null, context.subscriptions);

	context.subscriptions.push(vscode.commands.registerCommand(
		"lowlightgoerrors.LowOpacity", ()=>{
			opacityType = "Low";
			triggerLowlight(true);
		}
	));
	context.subscriptions.push(vscode.commands.registerCommand(
		"lowlightgoerrors.MediumOpacity", ()=>{
			opacityType = "Medium";
			triggerLowlight(true);
		}
	));
	context.subscriptions.push(vscode.commands.registerCommand(
		"lowlightgoerrors.HighOpacity", ()=>{
			opacityType = "High";
			triggerLowlight(true);
		}
	));
	context.subscriptions.push(vscode.commands.registerCommand(
		"lowlightgoerrors.Toggle", ()=>{
			if(opacityType === "High"){
				opacityType = "Low";
			}else{
				opacityType = "High";
			}
			triggerLowlight(true);
		}
	));
}

export function deactivate() { }

const computeRanges = function (editor: vscode.TextEditor, workbenchConfig: vscode.WorkspaceConfiguration) : vscode.Range[] {
	let text = editor.document.getText();
	let ranges = new Array<vscode.Range>();

	let toggleInline = workbenchConfig.get<boolean>('lowlightgoerrors.LowlightInlineErrors');

	// Match error variables with any name beginning with "err" (e.g. err, errSomeName).
	let searchRegex = /if err\w* != nil {/g;
	let inlineSearchRegex = /; err\w* != nil {/g;
	let match: RegExpExecArray | null;

	while((match = searchRegex.exec(text)) !== null) {
		ranges.push(constructRange(editor, match.index, match[0], text));
	}
	if(toggleInline) {
		while((match = inlineSearchRegex.exec(text)) !== null) {
			ranges.push(constructRange(editor, match.index, match[0], text));
		}
	}

	return ranges;
};

const constructRange = function(editor: vscode.TextEditor, i: number, searchString: string, text: string) : vscode.Range {
	var startIndex = i + searchString.length;
	let textPart = text.substr(startIndex);

	let skip = 0;
	var j = 0;
	for(j; j<textPart.length; j++) {
		let char = textPart.charAt(j);
		if(char === "{"){
			skip++;
		};
		if(char === "}"){
			if (skip > 0) {
				skip--;
			} else {
				break;
			}
		}
	}
	j = j + 1;

	let startPos = editor.document.positionAt(i);
	let endPos = editor.document.positionAt(startIndex + j);

	return new vscode.Range(startPos, endPos);
};

const rangesEqual = function(a: vscode.Range[], b: vscode.Range[]) : boolean {
	if (a.length !== b.length) {
		return false;
	}
	for (let i = 0; i < a.length; i++) {
		if (!a[i].isEqual(b[i])) {
			return false;
		}
	}
	return true;
};

const getOpacity = function(type?: string) : string {
	const workbenchConfig = vscode.workspace.getConfiguration();
	if(!type) {
		type = workbenchConfig.get<string>('lowlightgoerrors.DefaultOpacity');
	}
	const opacitySetting = 'lowlightgoerrors.' + type + 'Opacity';
	var opacity = workbenchConfig.get<string>(opacitySetting);

	if(!opacity) {
		vscode.window.showWarningMessage(opacitySetting + " cannot be empty.");
		return "";
	}
	return opacity;
};
