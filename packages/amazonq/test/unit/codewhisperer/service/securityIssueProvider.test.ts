/*!
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import * as vscode from 'vscode'
import { SecurityIssueProvider, CodeScansState } from 'aws-core-vscode/codewhisperer'
import { createCodeScanIssue, createMockDocument, createTextDocumentChangeEvent } from 'aws-core-vscode/test'
import assert from 'assert'

class MockProvider extends SecurityIssueProvider {}

describe('securityIssueProvider', () => {
    let mockProvider: MockProvider
    let mockDocument: vscode.TextDocument

    beforeEach(() => {
        mockProvider = new MockProvider()
        mockDocument = createMockDocument('def two_sum(nums, target):\nfor', 'test.py', 'python')
    })

    it('removes the issue if the document change on the same line if auto scan is disabled', async () => {
        await CodeScansState.instance.setScansEnabled(false)
        mockProvider.issues = [{ filePath: mockDocument.fileName, issues: [createCodeScanIssue()] }]

        assert.strictEqual(mockProvider.issues[0].issues.length, 1)

        const changeEvent = createTextDocumentChangeEvent(mockDocument, new vscode.Range(0, 0, 0, 0), 'a')
        mockProvider.handleDocumentChange(changeEvent)

        assert.strictEqual(mockProvider.issues[0].issues.length, 0)
    })

    it('offsets the existing issue down a line if a new line is inserted above', () => {
        mockProvider.issues = [
            { filePath: mockDocument.fileName, issues: [createCodeScanIssue({ startLine: 1, endLine: 2 })] },
        ]
        assert.strictEqual(mockProvider.issues[0].issues[0].startLine, 1)
        assert.strictEqual(mockProvider.issues[0].issues[0].endLine, 2)
        assert.ok(mockProvider.issues[0].issues[0].suggestedFixes[0].code?.startsWith('@@ -1,1 +1,1 @@'))

        const changeEvent = createTextDocumentChangeEvent(mockDocument, new vscode.Range(0, 0, 0, 0), '\n')
        mockProvider.handleDocumentChange(changeEvent)

        assert.strictEqual(mockProvider.issues[0].issues[0].startLine, 2)
        assert.strictEqual(mockProvider.issues[0].issues[0].endLine, 3)
        assert.ok(mockProvider.issues[0].issues[0].suggestedFixes[0].code?.startsWith('@@ -2,1 +2,1 @@'))
    })

    it('does not move the issue if the document changed below the line', () => {
        mockProvider.issues = [{ filePath: mockDocument.fileName, issues: [createCodeScanIssue()] }]

        assert.strictEqual(mockProvider.issues[0].issues[0].startLine, 0)
        assert.strictEqual(mockProvider.issues[0].issues[0].endLine, 1)
        assert.ok(mockProvider.issues[0].issues[0].suggestedFixes[0].code?.startsWith('@@ -1,1 +1,1 @@'))

        const changeEvent = createTextDocumentChangeEvent(mockDocument, new vscode.Range(2, 0, 2, 0), '\n')
        mockProvider.handleDocumentChange(changeEvent)

        assert.strictEqual(mockProvider.issues[0].issues[0].startLine, 0)
        assert.strictEqual(mockProvider.issues[0].issues[0].endLine, 1)
        assert.ok(mockProvider.issues[0].issues[0].suggestedFixes[0].code?.startsWith('@@ -1,1 +1,1 @@'))
    })

    it('should do nothing if no content changes', () => {
        mockProvider.issues = [
            { filePath: mockDocument.fileName, issues: [createCodeScanIssue({ startLine: 1, endLine: 2 })] },
        ]

        assert.strictEqual(mockProvider.issues[0].issues[0].startLine, 1)
        assert.strictEqual(mockProvider.issues[0].issues[0].endLine, 2)
        assert.ok(mockProvider.issues[0].issues[0].suggestedFixes[0].code?.startsWith('@@ -1,1 +1,1 @@'))

        const changeEvent = createTextDocumentChangeEvent(mockDocument, new vscode.Range(0, 0, 0, 0), '')
        changeEvent.contentChanges = []
        mockProvider.handleDocumentChange(changeEvent)

        assert.strictEqual(mockProvider.issues[0].issues[0].startLine, 1)
        assert.strictEqual(mockProvider.issues[0].issues[0].endLine, 2)
        assert.ok(mockProvider.issues[0].issues[0].suggestedFixes[0].code?.startsWith('@@ -1,1 +1,1 @@'))
    })

    it('should do nothing if file path does not match', () => {
        mockProvider.issues = [{ filePath: 'some/path', issues: [createCodeScanIssue({ startLine: 1, endLine: 2 })] }]
        assert.strictEqual(mockProvider.issues[0].issues[0].startLine, 1)
        assert.strictEqual(mockProvider.issues[0].issues[0].endLine, 2)
        assert.ok(mockProvider.issues[0].issues[0].suggestedFixes[0].code?.startsWith('@@ -1,1 +1,1 @@'))

        const changeEvent = createTextDocumentChangeEvent(mockDocument, new vscode.Range(0, 0, 0, 0), '\n')
        mockProvider.handleDocumentChange(changeEvent)

        assert.strictEqual(mockProvider.issues[0].issues[0].startLine, 1)
        assert.strictEqual(mockProvider.issues[0].issues[0].endLine, 2)
        assert.ok(mockProvider.issues[0].issues[0].suggestedFixes[0].code?.startsWith('@@ -1,1 +1,1 @@'))
    })

    describe('removeIssue', () => {
        it('should remove an issue from the issue list', () => {
            mockProvider.issues = [
                {
                    filePath: mockDocument.fileName,
                    issues: [
                        createCodeScanIssue({ findingId: 'finding-1' }),
                        createCodeScanIssue({ findingId: 'finding-2' }),
                    ],
                },
            ]
            mockProvider.removeIssue(
                vscode.Uri.file(mockDocument.fileName),
                createCodeScanIssue({ findingId: 'finding-1' })
            )

            assert.strictEqual(mockProvider.issues[0].issues.length, 1)
            assert.strictEqual(mockProvider.issues[0].issues[0].findingId, 'finding-2')
        })

        it('should not remove an issue if file path does not match', () => {
            mockProvider.issues = [
                {
                    filePath: mockDocument.fileName,
                    issues: [
                        createCodeScanIssue({ findingId: 'finding-1' }),
                        createCodeScanIssue({ findingId: 'finding-2' }),
                    ],
                },
            ]
            mockProvider.removeIssue(vscode.Uri.file('some/path'), createCodeScanIssue({ findingId: 'finding-1' }))

            assert.strictEqual(mockProvider.issues[0].issues.length, 2)
        })
    })
})
