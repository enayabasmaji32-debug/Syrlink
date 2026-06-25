"""News utility functions for generating SyrLink news feed."""
import random

CATEGORY_KEYWORDS = {
    'تقنية': ['tech', 'technology', 'برمج', 'تطوير', 'تقنية', 'ai', 'data', 'machine learning', 'برمجيات', 'software', 'hardware'],
    'وظائف': ['وظيفة', 'توظيف', 'career', 'job', 'hiring', 'موظف', 'وظائف', 'تدريب', 'internship', 'job fair'],
    'شركات ناشئة': ['ناشئة', 'startup', 'تمويل', 'funding', 'entrepreneur', 'شركة ناشئة', 'incubator', 'accelerator'],
    'سوق': ['سوق', 'استثمار', 'سهم', 'بورصة', 'trade', 'تجارة', 'سعر', 'market', 'crypto', 'عملات'],
    'مجتمع': ['مجتمع', 'events', 'لقاء', 'network', 'دعم', 'community', 'منظمة', 'نشاط', 'culture'],
}

CATEGORY_LABELS = ['تقنية', 'وظائف', 'شركات ناشئة', 'سوق', 'مجتمع']


def detectCategory(content: str) -> str:
    text = (content or '').lower()
    for category, keywords in CATEGORY_KEYWORDS.items():
        for keyword in keywords:
            if keyword in text:
                return category
    return 'مجتمع'


def rewriteHeadline(content: str) -> str:
    text = (content or '').strip().replace('\n', ' ').replace('\r', ' ')
    if not text:
        return 'خبر رائج من SyrLink'
    first_sentence = text.split('. ')[0].strip()
    if len(first_sentence) < 12 and len(text) > 60:
        first_sentence = text[:60].strip()
    headline = first_sentence[:80].rstrip()
    if len(text) > len(headline):
        headline = headline.rstrip('.,') + '...'
    return headline


def summarizePost(content: str) -> str:
    text = (content or '').strip().replace('\n', ' ').replace('\r', ' ')
    if not text:
        return 'اكتشف أهم الأخبار والمشاركات الرائجة على منصة SyrLink.'
    sentences = [s.strip() for s in text.split('. ') if s.strip()]
    if sentences:
        summary = sentences[0]
    else:
        summary = text
    if len(summary) > 120:
        return summary[:117].rstrip() + '...'
    return summary
