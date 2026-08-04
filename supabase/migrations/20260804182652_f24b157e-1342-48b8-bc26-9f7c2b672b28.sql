UPDATE survey_response_items i
SET value_text = 'ja'
FROM survey_responses r
WHERE r.id = i.response_id
  AND r.survey_id = '4c7db36c-bda6-4f6a-bc8c-e33b8a200b30'
  AND i.question_label ILIKE '%vor der Nutzung des Geräts geschult%'
  AND lower(coalesce(i.value_text,'')) = 'nein';

DELETE FROM survey_ai_summaries
WHERE survey_id = '4c7db36c-bda6-4f6a-bc8c-e33b8a200b30';