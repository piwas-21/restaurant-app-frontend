// src/components/feedback/FeedbackForm.tsx
"use client";

import React, { useState } from 'react';
import styles from '@/app/styles/FeedbackForm.module.css'; // Create this CSS module
import { useTranslation } from 'react-i18next';

interface FeedbackFormProps {
  dishId: string; // Or some identifier for what is being rated
  onSubmitSuccess: () => void;
}

const FeedbackForm: React.FC<FeedbackFormProps> = ({ dishId, onSubmitSuccess }) => {
  const { t } = useTranslation();
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [name, setName] = useState(''); // Optional: ask for user's name
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleRatingChange = (newRating: number) => {
    setRating(newRating);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    if (rating === 0) {
      setError(t('feedback_form_error_rating_required'));
      setIsSubmitting(false);
      return;
    }

    // Placeholder for API call
    console.log('Submitting feedback:', { dishId, rating, comment, name });
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1000));

    // On successful submission (simulated)
    setIsSubmitting(false);
    setRating(0);
    setComment('');
    setName('');
    onSubmitSuccess();
    alert(t('feedback_form_submit_success_message'));
  };

  return (
    <form onSubmit={handleSubmit} className={styles.feedbackForm} aria-labelledby="feedback-form-heading">
      <h3 id="feedback-form-heading" className="sr-only">{t('feedback_form_heading')}</h3>
      
      <div className={styles.formGroup} role="group" aria-labelledby="rating-label">
        <label id="rating-label" className={styles.ratingLabel}>{t('feedback_form_rating_label')}:</label>
        <div className={styles.starRating}>
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              type="button"
              className={star <= rating ? styles.starFilled : styles.starEmpty}
              onClick={() => handleRatingChange(star)}
              aria-label={t('feedback_form_star_rating_aria_label', { count: star })}
              aria-pressed={star === rating}
            >
              ★
            </button>
          ))}
        </div>
      </div>

      <div className={styles.formGroup}>
        <label htmlFor="comment">{t('feedback_form_comment_label')}:</label>
        <textarea
          id="comment"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          className={styles.textareaInput}
          placeholder={t('feedback_form_comment_placeholder')}
          rows={4}
        />
      </div>

      <div className={styles.formGroup}>
        <label htmlFor="name">{t('feedback_form_name_label')} ({t('feedback_form_optional_label')}):</label>
        <input
          type="text"
          id="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className={styles.textInput}
          placeholder={t('feedback_form_name_placeholder')}
        />
      </div>

      {error && <p className={styles.errorMessage} role="alert">{error}</p>}

      <button type="submit" className={styles.submitButton} disabled={isSubmitting}>
        {isSubmitting ? t('feedback_form_submitting_button') : t('feedback_form_submit_button')}
      </button>
    </form>
  );
};

export default FeedbackForm;

