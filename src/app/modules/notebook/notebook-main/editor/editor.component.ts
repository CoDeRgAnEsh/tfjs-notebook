import { Component, OnInit, Input, Output, EventEmitter } from '@angular/core';
import { EditorType, EditorContent, ConsoleSeverity, ConsoleOutput } from '../../editor-content';

type LogFunction = (message?: any, ...params: any[]) => void;


// TODO: this component is too complex; it should be refactored
@Component({
  selector: 'tfn-editor',
  template: `
  <mat-expansion-panel
        *ngIf="isCodeEditor() || !isClosed()"
        [expanded]="editorContent.editorExpanded"
        (opened)="editorContent.editorExpanded = true"
        (closed)="editorContent.editorExpanded = false">
      <mat-expansion-panel-header>
        <button mat-icon-button  *ngIf="isCodeEditor()" color="primary" (click)="runCode($event)" matTooltip="Run the code cell">
          <mat-icon>play_arrow</mat-icon></button>
        <button mat-icon-button  *ngIf="!isCodeEditor()" (click)="closeComment()" matTooltip="Reduce the size of the comment cell">
          <mat-icon>close</mat-icon></button>
        <tfn-toolbar-divider></tfn-toolbar-divider>
        <button mat-icon-button (click)="emitAddCodeEvent($event)" matTooltip="Add a new code cell below"><mat-icon>add</mat-icon></button>
        <button mat-icon-button (click)="emitAddCommentEvent($event)" matTooltip="Add a new comment cell below">
          <mat-icon>add_comment</mat-icon></button>
        <tfn-toolbar-divider></tfn-toolbar-divider>
        <button mat-icon-button (click)="emitDeleteEvent($event)" matTooltip="Delete this cell"><mat-icon>delete</mat-icon></button>
      </mat-expansion-panel-header>
      <mat-form-field class="concrete-editor">
        <textarea
          *ngIf="!isCodeEditor()"
          matTextareaAutosize matInput
          [placeholder]="getPlaceholder()"
          [(ngModel)]="editorContent.content"
          (change)="emitContentChanged()"></textarea>
        <mat-codemirror
          *ngIf="isCodeEditor()"
          [(ngModel)]="editorContent.content"
          [options]="{ theme: 'neat', mode: 'javascript' }"
          [placeholder]="getPlaceholder()"
          (change)="emitContentChanged()"></mat-codemirror>
      </mat-form-field>
    </mat-expansion-panel>
    <div *ngIf="!isCodeEditor() && isClosed()">
      <p>
        <button mat-icon-button (click)="openComment()" matTooltip="Open the comment editor"><mat-icon>comment</mat-icon></button>
        <span>{{ editorContent.content }}</span>
      </p>
    </div>
    <mat-expansion-panel class="console"
        [expanded]="editorContent.consoleExpanded"
        (opened)="editorContent.consoleExpanded=true"
        (closed)="editorContent.consoleExpanded=false"
        *ngIf="editorContent.consoleOutput.length > 0">
      <mat-expansion-panel-header>Output:</mat-expansion-panel-header>
      <div class="console-content-wrapper">
        <pre class="console-content"><span *ngFor="let consoleOutput of editorContent.consoleOutput"
          [class.error]="isError(consoleOutput)"
          [class.warn]="isWarn(consoleOutput)">{{ consoleOutput.content }}</span>
        </pre>
      </div>
    </mat-expansion-panel>
  `,
  styles: [`
    .concrete-editor {
      width: 100%;
    }

    .console {
      margin: 16px 0 0 0;
    }

    .console-content {
      margin: 0;
    }

    .console-content-wrapper {
      overflow-x: auto;
    }

    .error {
      color: red;
    }

    .warn {
      color: orange;
    }
    `]
})
export class EditorComponent implements OnInit {

  @Input() editorContent: EditorContent;

  @Input() currentEditorContents: EditorContent[] = [];

  @Output() deleted = new EventEmitter<EditorContent>();

  @Output() commentAdded = new EventEmitter<EditorContent>();

  @Output() codeAdded = new EventEmitter<EditorContent>();

  @Output() codeExecuted = new EventEmitter<EditorContent>();

  @Output() contentChanged = new EventEmitter<EditorContent>();

  constructor() { }

  ngOnInit() {
  }

  isCodeEditor() {
     return this.editorContent.type === EditorType.CODE;
  }

  isClosed() {
    return this.editorContent.closed;
  }

  closeComment() {
    this.editorContent.closed = true;
    this.contentChanged.emit(this.editorContent);
  }

  openComment() {
    this.editorContent.closed = false;
  }

  emitContentChanged() {
    this.contentChanged.emit(this.editorContent);
  }

  getPlaceholder() {
    if (this.isCodeEditor()) {
      return 'Javascript';
    } else {
      return 'Comment';
    }
  }

  emitDeleteEvent(event: Event) {
    this.deleted.emit(this.editorContent);
    event.stopPropagation();
  }

  emitAddCommentEvent(event: Event) {
    this.commentAdded.emit(this.editorContent);
    event.stopPropagation();
  }

  emitAddCodeEvent(event: Event) {
    this.codeAdded.emit(this.editorContent);
    event.stopPropagation();
  }

  runCode(event: Event) {
    event.stopPropagation();

    console.log('running script...');

    this.editorContent.consoleOutput = [];
    const originalFunctions = this.replaceConsoleLogs();

    this.prepareOutputs();

    // tslint:disable:prefer-const
    // tslint:disable:no-var-keyword
    var outputs = this.prepareOutputs();
    var prev = this.preparePrev();

    // tslint:disable:no-eval
    this.editorContent.output = eval(this.editorContent.content); // TODO: check this for security

    if (this.editorContent.output instanceof Promise) {
      this.editorContent.output.then((result: any) => {
        this.editorContent.output = result;
        this.log(ConsoleSeverity.LOG, this.editorContent.output);
        this.restoreConsoleLogs(originalFunctions);
        this.codeExecuted.emit(this.editorContent);
      });
    } else {
      this.log(ConsoleSeverity.LOG, this.editorContent.output);
      this.restoreConsoleLogs(originalFunctions);
      this.codeExecuted.emit(this.editorContent);
    }
  }

  private prepareOutputs(): any[] {
    const outputs = [];

    this.getCodeContents().forEach(content => {
      outputs.push(content.output);
    });

    return outputs;

  }

  private preparePrev() {
    let prev;

    const codeContents = this.getCodeContents();

    const currentIndex = codeContents.indexOf(this.editorContent);
    if (currentIndex > 0) {
      prev = codeContents[currentIndex - 1].output;
    }
    return prev;
  }

  private getCodeContents(): EditorContent[] {
    return this.currentEditorContents.filter((content: EditorContent) => content.type === EditorType.CODE);
  }

  private replaceConsoleLogs(): LogFunction[] {
    const originalFunctions = [console.log, console.warn, console.error];

    console.log = (message?: any, ...params: any[]) => {
      this.log(ConsoleSeverity.LOG, message, params);
      console.trace.apply(message, params);
    };
    console.warn = (message?: any, ...params: any[]) => {
      this.log(ConsoleSeverity.WARN, message, params);
      console.trace.apply(message, params);
    };
    console.error = (message?: any, ...params: any[]) => {
      this.log(ConsoleSeverity.ERROR, message, params);
      console.trace.apply(message, params);
    };

    return originalFunctions;
  }

  private restoreConsoleLogs(originalFunctions: LogFunction[]) {
    console.log = originalFunctions[0];
    console.warn = originalFunctions[1];
    console.error = originalFunctions[2];
  }

  private log(severity: ConsoleSeverity, message?: any, ...params: any[]) {
    let wholeMessage = '';

    if (severity === ConsoleSeverity.ERROR && message === 'ERROR') {
      params[0].forEach(error => {
        wholeMessage = error.message;
        wholeMessage += '\n';
        wholeMessage += error.stack;
        wholeMessage += '\n';
      });
    } else {
      wholeMessage = message;

      params.forEach(param => {
        wholeMessage += param;
      });
      wholeMessage += '\n';
    }

    this.editorContent.consoleOutput.push(new ConsoleOutput(severity, wholeMessage));
  }

  isError(consoleOutput: ConsoleOutput) {
    return consoleOutput.severity === ConsoleSeverity.ERROR;
  }

  isWarn(consoleOutput: ConsoleOutput) {
    return consoleOutput.severity === ConsoleSeverity.WARN;
  }

}
