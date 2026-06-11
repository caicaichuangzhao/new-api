package service

import (
	"testing"

	"github.com/QuantumNous/new-api/dto"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/stretchr/testify/require"
)

func newClaudeConvertRelayInfo() *relaycommon.RelayInfo {
	return &relaycommon.RelayInfo{
		ClaudeConvertInfo: &relaycommon.ClaudeConvertInfo{
			LastMessagesType: relaycommon.LastMessageTypeNone,
		},
	}
}

func TestStreamResponseOpenAI2ClaudeQueuesToolArgumentsUntilBlockStart(t *testing.T) {
	info := newClaudeConvertRelayInfo()

	toolIndex := 0
	info.SendResponseCount = 1
	first := &dto.ChatCompletionsStreamResponse{
		Id:    "chatcmpl-test",
		Model: "claude-fable-5",
		Choices: []dto.ChatCompletionsStreamResponseChoice{
			{
				Delta: dto.ChatCompletionsStreamResponseChoiceDelta{
					ToolCalls: []dto.ToolCallResponse{
						{
							Index: &toolIndex,
							Function: dto.FunctionResponse{
								Arguments: `{"query":"`,
							},
						},
					},
				},
			},
		},
	}

	firstEvents := StreamResponseOpenAI2Claude(first, info)
	require.Len(t, firstEvents, 1)
	require.Equal(t, "message_start", firstEvents[0].Type)
	require.False(t, info.ClaudeConvertInfo.ToolCallStarted[0])
	require.Equal(t, `{"query":"`, info.ClaudeConvertInfo.ToolCallPendingArgs[0])

	info.SendResponseCount = 2
	second := &dto.ChatCompletionsStreamResponse{
		Id:    "chatcmpl-test",
		Model: "claude-fable-5",
		Choices: []dto.ChatCompletionsStreamResponseChoice{
			{
				Delta: dto.ChatCompletionsStreamResponseChoiceDelta{
					ToolCalls: []dto.ToolCallResponse{
						{
							Index: &toolIndex,
							ID:    "call_1",
							Type:  "function",
							Function: dto.FunctionResponse{
								Name:      "search",
								Arguments: `weather"}`,
							},
						},
					},
				},
			},
		},
	}

	secondEvents := StreamResponseOpenAI2Claude(second, info)
	require.Len(t, secondEvents, 3)
	require.Equal(t, "content_block_start", secondEvents[0].Type)
	require.Equal(t, "tool_use", secondEvents[0].ContentBlock.Type)
	require.Equal(t, "call_1", secondEvents[0].ContentBlock.Id)
	require.Equal(t, "search", secondEvents[0].ContentBlock.Name)
	require.Equal(t, "content_block_delta", secondEvents[1].Type)
	require.Equal(t, "input_json_delta", secondEvents[1].Delta.Type)
	require.Equal(t, `{"query":"`, *secondEvents[1].Delta.PartialJson)
	require.Equal(t, "content_block_delta", secondEvents[2].Type)
	require.Equal(t, "input_json_delta", secondEvents[2].Delta.Type)
	require.Equal(t, `weather"}`, *secondEvents[2].Delta.PartialJson)
	require.True(t, info.ClaudeConvertInfo.ToolCallStarted[0])
	require.Empty(t, info.ClaudeConvertInfo.ToolCallPendingArgs)

	info.SendResponseCount = 3
	finishReason := "tool_calls"
	finish := &dto.ChatCompletionsStreamResponse{
		Id:    "chatcmpl-test",
		Model: "claude-fable-5",
		Choices: []dto.ChatCompletionsStreamResponseChoice{
			{
				FinishReason: &finishReason,
			},
		},
		Usage: &dto.Usage{PromptTokens: 12, CompletionTokens: 3},
	}

	finishEvents := StreamResponseOpenAI2Claude(finish, info)
	require.Len(t, finishEvents, 3)
	require.Equal(t, "content_block_stop", finishEvents[0].Type)
	require.Equal(t, 0, finishEvents[0].GetIndex())
	require.Equal(t, "message_delta", finishEvents[1].Type)
	require.NotNil(t, finishEvents[1].Delta.StopReason)
	require.Equal(t, "tool_use", *finishEvents[1].Delta.StopReason)
	require.Equal(t, "message_stop", finishEvents[2].Type)
}

func TestStreamResponseOpenAI2ClaudeMergesSplitToolMetadata(t *testing.T) {
	info := newClaudeConvertRelayInfo()
	toolIndex := 0

	info.SendResponseCount = 1
	idOnly := &dto.ChatCompletionsStreamResponse{
		Id:    "chatcmpl-test",
		Model: "claude-fable-5",
		Choices: []dto.ChatCompletionsStreamResponseChoice{
			{
				Delta: dto.ChatCompletionsStreamResponseChoiceDelta{
					ToolCalls: []dto.ToolCallResponse{
						{
							Index: &toolIndex,
							ID:    "call_split",
							Type:  "function",
						},
					},
				},
			},
		},
	}

	idEvents := StreamResponseOpenAI2Claude(idOnly, info)
	require.Len(t, idEvents, 1)
	require.Equal(t, "message_start", idEvents[0].Type)
	require.False(t, info.ClaudeConvertInfo.ToolCallStarted[0])

	info.SendResponseCount = 2
	nameOnly := &dto.ChatCompletionsStreamResponse{
		Id:    "chatcmpl-test",
		Model: "claude-fable-5",
		Choices: []dto.ChatCompletionsStreamResponseChoice{
			{
				Delta: dto.ChatCompletionsStreamResponseChoiceDelta{
					ToolCalls: []dto.ToolCallResponse{
						{
							Index: &toolIndex,
							Function: dto.FunctionResponse{
								Name: "run_task",
							},
						},
					},
				},
			},
		},
	}

	nameEvents := StreamResponseOpenAI2Claude(nameOnly, info)
	require.Len(t, nameEvents, 1)
	require.Equal(t, "content_block_start", nameEvents[0].Type)
	require.Equal(t, "call_split", nameEvents[0].ContentBlock.Id)
	require.Equal(t, "run_task", nameEvents[0].ContentBlock.Name)

	info.SendResponseCount = 3
	argsOnly := &dto.ChatCompletionsStreamResponse{
		Id:    "chatcmpl-test",
		Model: "claude-fable-5",
		Choices: []dto.ChatCompletionsStreamResponseChoice{
			{
				Delta: dto.ChatCompletionsStreamResponseChoiceDelta{
					ToolCalls: []dto.ToolCallResponse{
						{
							Index: &toolIndex,
							Function: dto.FunctionResponse{
								Arguments: `{"path":"."}`,
							},
						},
					},
				},
			},
		},
	}

	argEvents := StreamResponseOpenAI2Claude(argsOnly, info)
	require.Len(t, argEvents, 1)
	require.Equal(t, "content_block_delta", argEvents[0].Type)
	require.Equal(t, "input_json_delta", argEvents[0].Delta.Type)
	require.Equal(t, `{"path":"."}`, *argEvents[0].Delta.PartialJson)
}

func TestStreamResponseOpenAI2ClaudeWaitsForToolIDBeforeBlockStart(t *testing.T) {
	info := newClaudeConvertRelayInfo()
	toolIndex := 0

	info.SendResponseCount = 1
	nameAndArgs := &dto.ChatCompletionsStreamResponse{
		Id:    "chatcmpl-test",
		Model: "claude-fable-5",
		Choices: []dto.ChatCompletionsStreamResponseChoice{
			{
				Delta: dto.ChatCompletionsStreamResponseChoiceDelta{
					ToolCalls: []dto.ToolCallResponse{
						{
							Index: &toolIndex,
							Type:  "function",
							Function: dto.FunctionResponse{
								Name:      "run_task",
								Arguments: `{"cmd":"`,
							},
						},
					},
				},
			},
		},
	}

	firstEvents := StreamResponseOpenAI2Claude(nameAndArgs, info)
	require.Len(t, firstEvents, 1)
	require.Equal(t, "message_start", firstEvents[0].Type)
	require.False(t, info.ClaudeConvertInfo.ToolCallStarted[0])
	require.Equal(t, `{"cmd":"`, info.ClaudeConvertInfo.ToolCallPendingArgs[0])

	info.SendResponseCount = 2
	idAndArgs := &dto.ChatCompletionsStreamResponse{
		Id:    "chatcmpl-test",
		Model: "claude-fable-5",
		Choices: []dto.ChatCompletionsStreamResponseChoice{
			{
				Delta: dto.ChatCompletionsStreamResponseChoiceDelta{
					ToolCalls: []dto.ToolCallResponse{
						{
							Index: &toolIndex,
							ID:    "call_late_id",
							Function: dto.FunctionResponse{
								Arguments: `pwd"}`,
							},
						},
					},
				},
			},
		},
	}

	secondEvents := StreamResponseOpenAI2Claude(idAndArgs, info)
	require.Len(t, secondEvents, 3)
	require.Equal(t, "content_block_start", secondEvents[0].Type)
	require.Equal(t, "call_late_id", secondEvents[0].ContentBlock.Id)
	require.Equal(t, "run_task", secondEvents[0].ContentBlock.Name)
	require.Equal(t, `{"cmd":"`, *secondEvents[1].Delta.PartialJson)
	require.Equal(t, `pwd"}`, *secondEvents[2].Delta.PartialJson)
}

func TestStreamResponseOpenAI2ClaudeHandlesParallelToolCallsInFirstChunk(t *testing.T) {
	info := newClaudeConvertRelayInfo()
	firstToolIndex := 0
	secondToolIndex := 1

	info.SendResponseCount = 1
	first := &dto.ChatCompletionsStreamResponse{
		Id:    "chatcmpl-test",
		Model: "claude-fable-5",
		Choices: []dto.ChatCompletionsStreamResponseChoice{
			{
				Delta: dto.ChatCompletionsStreamResponseChoiceDelta{
					ToolCalls: []dto.ToolCallResponse{
						{
							Index: &firstToolIndex,
							ID:    "call_first",
							Type:  "function",
							Function: dto.FunctionResponse{
								Name:      "read_file",
								Arguments: `{"path":"a.txt"}`,
							},
						},
						{
							Index: &secondToolIndex,
							ID:    "call_second",
							Type:  "function",
							Function: dto.FunctionResponse{
								Name:      "list_dir",
								Arguments: `{"path":"."}`,
							},
						},
					},
				},
			},
		},
	}

	events := StreamResponseOpenAI2Claude(first, info)
	require.Len(t, events, 5)
	require.Equal(t, "message_start", events[0].Type)
	require.Equal(t, "content_block_start", events[1].Type)
	require.Equal(t, 0, events[1].GetIndex())
	require.Equal(t, "call_first", events[1].ContentBlock.Id)
	require.Equal(t, "content_block_delta", events[2].Type)
	require.Equal(t, 0, events[2].GetIndex())
	require.Equal(t, "content_block_start", events[3].Type)
	require.Equal(t, 1, events[3].GetIndex())
	require.Equal(t, "call_second", events[3].ContentBlock.Id)
	require.Equal(t, "content_block_delta", events[4].Type)
	require.Equal(t, 1, events[4].GetIndex())

	info.SendResponseCount = 2
	finishReason := "tool_calls"
	finish := &dto.ChatCompletionsStreamResponse{
		Id:    "chatcmpl-test",
		Model: "claude-fable-5",
		Choices: []dto.ChatCompletionsStreamResponseChoice{
			{
				FinishReason: &finishReason,
			},
		},
		Usage: &dto.Usage{PromptTokens: 10, CompletionTokens: 6},
	}

	finishEvents := StreamResponseOpenAI2Claude(finish, info)
	require.Len(t, finishEvents, 4)
	require.Equal(t, "content_block_stop", finishEvents[0].Type)
	require.Equal(t, 0, finishEvents[0].GetIndex())
	require.Equal(t, "content_block_stop", finishEvents[1].Type)
	require.Equal(t, 1, finishEvents[1].GetIndex())
	require.Equal(t, "message_delta", finishEvents[2].Type)
	require.Equal(t, "message_stop", finishEvents[3].Type)
}
