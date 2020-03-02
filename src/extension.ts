import * as vscode from 'vscode';

export function activate(context: vscode.ExtensionContext) {
	let opacityType: string;
	let opacityTypeChanged: boolean = false;
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
			if(lastDecoration && opacityTypeChanged) {
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
			opacityTypeChanged = true;
			triggerLowlight();
		}
	));
	context.subscriptions.push(vscode.commands.registerCommand(
		"lowlightgoerrors.MediumOpacity", ()=>{
			opacityType = "Medium";
			opacityTypeChanged = true;
			triggerLowlight();
		}
	));
	context.subscriptions.push(vscode.commands.registerCommand(
		"lowlightgoerrors.HighOpacity", ()=>{
			opacityType = "High";
			opacityTypeChanged = true;
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
			opacityTypeChanged = true;
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

	let options: vscode.DecorationRenderOptions = {
		opacity: opacity,
		rangeBehavior: vscode.DecorationRangeBehavior.ClosedClosed
	};
	let decoration = vscode.window.createTextEditorDecorationType(options);
	
	let ranges = new Array<vscode.DecorationOptions>();


	let before = "if err != nil {";
	let after = "}";
	let regEx = new RegExp("(^|[ \\t])(" + before + "[\\s])+([\\s\\S]*?)(" + after + ")", "gm");

	let match: any;

	while (match = regEx.exec(text)) { 
		let startPos = editor.document.positionAt(match.index);
		let endPos = editor.document.positionAt(
						match.index + match[0].length);
		let range: vscode.DecorationOptions = { 
			range: new vscode.Range(startPos, endPos)
		};
		ranges.push(range);
	}
	editor.setDecorations(decoration, ranges);
	return decoration;
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