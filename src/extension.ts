import * as vscode from 'vscode';

export function activate(context: vscode.ExtensionContext) {
	let opacityType: string;
	let lastDecoration: vscode.TextEditorDecorationType;

	var timeout: NodeJS.Timer;
	function triggerLowlight() {
		if (timeout) {
			clearTimeout(timeout);
		}
		timeout = setTimeout(() => {
			const workbenchConfig = vscode.workspace.getConfiguration();
			if(!workbenchConfig.get<boolean>('lowlightgoerrors.Enabled')) {
				return;
			}
			if(lastDecoration) {
				lastDecoration.dispose();
			}
			lastDecoration = decorationLowlight(getOpacity(opacityType));
		}, 200);
	}

	if (vscode.window.activeTextEditor) {
		triggerLowlight();
	}

	vscode.window.onDidChangeActiveTextEditor(editor => {
		if(!editor) {
			return;
		}
		triggerLowlight();
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
			triggerLowlight();
		}
	));
	context.subscriptions.push(vscode.commands.registerCommand(
		"lowlightgoerrors.MediumOpacity", ()=>{
			opacityType = "Medium";
			triggerLowlight();
		}
	));
	context.subscriptions.push(vscode.commands.registerCommand(
		"lowlightgoerrors.HighOpacity", ()=>{
			opacityType = "High";
			triggerLowlight();
		}
	));
	context.subscriptions.push(vscode.commands.registerCommand(
		"lowlightgoerrors.Toggle", ()=>{
			if(opacityType === "High"){
				opacityType = "Low";
			}else{
				opacityType = "High";
			}
			triggerLowlight();
		}
	));
}

export function deactivate() { }

const decorationLowlight = function (opacity: string) : any {
	var editor = vscode.window.activeTextEditor;
	if(!editor){
		return;
	}
	if(!opacity){
		return;
	}
	let text = editor.document.getText();

	const workbenchConfig = vscode.workspace.getConfiguration();

	let options: vscode.DecorationRenderOptions = {
		opacity: opacity,
		rangeBehavior: vscode.DecorationRangeBehavior.ClosedClosed,
	};

	if(workbenchConfig.get<boolean>('lowlightgoerrors.ChangeColor')) {
		let color = workbenchConfig.get<string>('lowlightgoerrors.Color');
		if(!color?.match("^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$")) {
			vscode.window.showWarningMessage("lowlightgoerrors.Color is not a color code");
		}
		options.color = color;
	}

	let decoration = vscode.window.createTextEditorDecorationType(options);
	
	let ranges = new Array<vscode.DecorationOptions>();

	let toggleInline = workbenchConfig.get<boolean>('lowlightgoerrors.LowlightInlineErrors');

	let inlineSearchString = "; err != nil {";
	let searchString = "if err != nil {";
	for(var i = 0;i<text.length;i++){
		if(searchString === text.substr(i,searchString.length)) {
			ranges.push(constructRange(editor, i, searchString, text));
		}
		else if(toggleInline && inlineSearchString === text.substr(i, inlineSearchString.length)){
			ranges.push(constructRange(editor, i, inlineSearchString, text));
		}
	}
	editor.setDecorations(decoration, ranges);
	return decoration;
};

const constructRange = function(editor: vscode.TextEditor, i: number, searchString: string, text: string) : vscode.DecorationOptions {
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
	let range: vscode.DecorationOptions = { 
		range: new vscode.Range(startPos, endPos)
	};

	return range;
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