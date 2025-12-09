
import { EmailTemplate, Candidate, AssessmentConfig } from '../types';

export const DEFAULT_TEMPLATE: EmailTemplate = {
    id: 'default',
    name: 'Standard Invitation',
    subject: 'Action Required: Assessment Invitation for {assessmentName}',
    body: `Hello,

You have been invited to complete the following assessment: {assessmentName}.

Your Access Code is: {accessCode}

Please visit the portal to begin your assessment.
Time Limit: {duration} minutes.

Link: {link}

Good luck,
The Team`,
    isDefault: true
};

export const parseEmail = (
    template: EmailTemplate, 
    candidate: Candidate, 
    config: AssessmentConfig
): { subject: string, body: string } => {
    
    let subject = template.subject;
    let body = template.body;

    const replacements: Record<string, string> = {
        '{name}': candidate.email.split('@')[0], // Simple username derivation
        '{email}': candidate.email,
        '{accessCode}': candidate.accessCode,
        '{assessmentName}': config.name,
        '{duration}': config.durationMinutes.toString(),
        '{link}': window.location.origin
    };

    Object.entries(replacements).forEach(([key, value]) => {
        // Regex to replace all occurrences
        const regex = new RegExp(key, 'g');
        subject = subject.replace(regex, value);
        body = body.replace(regex, value);
    });

    return { subject, body };
};

/**
 * Triggers the user's default email client with the pre-filled content.
 * Uses a hidden anchor tag to ensure better compatibility than window.location.href.
 */
export const openMailClient = (to: string, subject: string, body: string) => {
    const encodedSubject = encodeURIComponent(subject);
    const encodedBody = encodeURIComponent(body);
    const mailtoLink = `mailto:${to}?subject=${encodedSubject}&body=${encodedBody}`;
    
    // Create a temporary link and click it to trigger the mail client
    // This avoids some issues with window.location.href in SPAs or iframes
    const link = document.createElement('a');
    link.href = mailtoLink;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.style.display = 'none';
    document.body.appendChild(link);
    
    try {
        link.click();
    } catch (e) {
        console.error("Failed to open mail client via link click", e);
        // Fallback
        window.location.href = mailtoLink;
    } finally {
        document.body.removeChild(link);
    }
};
