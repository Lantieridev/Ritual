import { builder } from './builder'
import type { ErrorCodeType } from '@/src/core/types'

export type ErrorCode = ErrorCodeType;

export const ErrorCodeRef = builder.enumType('ErrorCode', {
    values: {
        VALIDATION: { value: 'VALIDATION' },
        UNAUTHENTICATED: { value: 'UNAUTHENTICATED' },
        CONFLICT: { value: 'CONFLICT' },
        NOT_FOUND: { value: 'NOT_FOUND' },
        SERVER_ERROR: { value: 'SERVER_ERROR' },
    }
})

export const MutationResultRef = builder.objectRef<{ success: boolean; error?: string; errorCode?: ErrorCode }>('MutationResult')
MutationResultRef.implement({
    fields: (t) => ({
        success: t.exposeBoolean('success'),
        error: t.exposeString('error', { nullable: true }),
        errorCode: t.expose('errorCode', { type: ErrorCodeRef, nullable: true }),
    }),
})

export function toMutationResult(result: { error?: string; errorCode?: ErrorCode }): { success: boolean; error?: string; errorCode?: ErrorCode } {
    return { success: !result.error, error: result.error, errorCode: result.errorCode }
}
