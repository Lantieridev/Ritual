export interface EmailMessage {
    to: string
    subject: string
    text: string
    html: string
}

/** Provider seam: tests inject a fake, swapping Resend for another provider touches one file. */
export interface EmailSender {
    /** Resolves on success, throws on any failure. */
    send(message: EmailMessage): Promise<void>
}
