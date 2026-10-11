"""Deterministic KopiKu knowledge base for the RAG lab (module 3.5). Standard library only.

build() returns (documents, eval_set):
  documents: [{"doc_id", "category", "text"}]  (Markdown-ish: "# heading" paragraphs separated by blank lines)
  eval_set:  [{"query", "doc_id"}]             (a question and the ONE document that answers it)
"""
import random

STORES = [("Kemang", "Jl. Kemang Raya 12, Jakarta"), ("Senayan", "Senayan City level 2, Jakarta"),
          ("Menteng", "Jl. Cikini Raya 8, Jakarta"), ("Sudirman", "Sudirman Central Business District, Jakarta"),
          ("Dago", "Jl. Ir. H. Djuanda 55, Bandung"), ("Braga", "Jl. Braga 21, Bandung"),
          ("Cihampelas", "Jl. Cihampelas 140, Bandung"), ("Malioboro", "Jl. Malioboro 60, Yogyakarta"),
          ("Tunjungan", "Tunjungan Plaza 3, Surabaya"), ("Seminyak", "Jl. Kayu Aya 33, Bali"),
          ("Ubud", "Jl. Raya Ubud 7, Bali"), ("Kuta", "Jl. Pantai Kuta 19, Bali")]

PRODUCTS = ["Kopi Susu Gula Aren", "Es Kopi Pandan", "Americano", "Cold Brew Toraja", "Flat White", "Matcha Latte",
            "Es Teh Tarik", "Croissant Almond", "Roti Bakar Cokelat", "Pisang Goreng Keju", "Nasi Goreng Kampung",
            "Mie Goreng Jawa", "Chicken Katsu Rice", "Brownies Walnut", "Cheesecake Blueberry", "Teh Tubruk",
            "Wedang Jahe", "Es Cendol Durian", "Kopi Tubruk Lampung", "Latte Hazelnut", "Mocha Caramel",
            "Espresso Tonic", "Smoothie Mangga", "Jus Alpukat", "Sandwich Tuna", "Bubur Ayam", "Sate Taichan Bowl",
            "Es Lemon Tea", "Pancake Pisang", "Donat Kentang"]

ALLERGENS = ["milk", "peanuts", "gluten", "eggs", "soy", "tree nuts", "sesame", "none of the 14 major allergens"]
PAYMENTS = ["QRIS", "GoPay", "OVO", "debit card", "credit card", "cash", "ShopeePay", "DANA"]
POLICIES = [
    ("Refund for late delivery", "refund", "If a delivery arrives more than {n} minutes late, the delivery fee is refunded as KopiKu points within {m} days. Contact support with the order number."),
    ("Loyalty points expiry", "loyalty", "Loyalty points expire {n} months after they are earned. Each {m} thousand rupiah spent earns one point."),
    ("Voucher stacking rules", "voucher", "Only {n} voucher can be applied to a single order. Vouchers cannot be stacked with the student discount."),
    ("Gift card balance", "giftcard", "Gift cards never expire and can be topped up. A lost gift card can be blocked within {n} hours of reporting."),
    ("Catering order cancellation", "catering", "Catering orders can be cancelled free of charge up to {n} hours before the event. Later cancellations are charged {m} percent."),
    ("Student discount", "student", "Students get {n} percent off drinks with a valid student card, Monday to Friday before 15:00."),
    ("Birthday reward", "birthday", "Members receive a free drink in their birthday month. The reward is valid for {n} days from the first of the month."),
    ("Corporate invoicing", "invoice", "Companies can pay by monthly invoice after a credit check. Invoices are due {n} days after issue."),
    ("Data privacy requests", "privacy", "Customers can ask for a copy of their personal data or ask us to delete it. We answer within {n} working days."),
    ("Delivery radius and minimum order", "radius", "We deliver within {n} kilometres of each store, with a minimum order of {m} thousand rupiah."),
    ("Packaging recycling programme", "recycling", "Bring {n} used KopiKu cups to any store and receive a free upgrade to a larger size."),
    ("Table reservations", "reservation", "Groups of {n} or more can reserve a table up to {m} days ahead through the app."),
    ("Free wifi usage", "wifi", "Free wifi is available in every store. Sessions last {n} hours and then ask you to sign in again."),
    ("Lost property", "lost", "Items left in a store are kept for {n} days. Ask the store manager or message support with a description."),
    ("Complaints and feedback", "complaint", "We reply to every complaint within {n} working days. Serious cases are escalated to the area manager."),
    ("Franchise enquiries", "franchise", "Prospective franchise partners should submit the form. The first interview happens within {n} weeks."),
    ("Allergen information", "allergy", "Allergens are listed on every product page. Our kitchens handle milk, gluten, nuts and soy, so cross contact is possible."),
    ("Coffee bean subscription", "subscription", "Subscribers receive {n} grams of beans every {m} weeks and can pause the plan at any time."),
    ("Employee tips distribution", "tips", "Tips paid by QRIS are pooled and shared among the store team each {n} weeks."),
    ("Price changes notice", "pricing", "Menu prices change at most twice a year, with {n} days of notice published in the app."),
]
POLICY_QUESTIONS = {
    "refund": "my delivery came very late, do I get my delivery fee back",
    "loyalty": "when do my loyalty points expire",
    "voucher": "can I use two vouchers on one order",
    "giftcard": "I lost my gift card, can it be blocked",
    "catering": "how late can I cancel a catering order without a charge",
    "student": "is there a discount with a student card",
    "birthday": "what is the birthday reward for members",
    "invoice": "can our company pay by monthly invoice",
    "privacy": "how do I ask you to delete my personal data",
    "radius": "how far do you deliver and what is the minimum order",
    "recycling": "do I get anything for bringing used cups",
    "reservation": "how do I reserve a table for a group",
    "wifi": "how long does a free wifi session last",
    "lost": "I left my umbrella in a store, how long is it kept",
    "complaint": "how fast do you reply to a complaint",
    "franchise": "I want to open a franchise, what is the process",
    "allergy": "where do I find allergen information",
    "subscription": "how does the coffee bean subscription work",
    "tips": "how are tips shared among staff",
    "pricing": "how often do menu prices change",
}


def build(seed=11):
    rng = random.Random(seed)
    docs, evals = [], []

    def add(doc_id, category, parts, query=None):
        docs.append({"doc_id": doc_id, "category": category, "text": "\n\n".join(parts)})
        if query:
            evals.append({"query": query, "doc_id": doc_id})

    for name, address in STORES:
        slug = name.lower()
        o, c = rng.choice([7, 8, 9]), rng.choice([21, 22, 23])
        add(f"store-{slug}-hours", "stores", [
            f"# Opening hours at {name}",
            f"The {name} store at {address} opens at {o:02d}:00 and closes at {c}:00 on weekdays.",
            f"On weekends the {name} store opens {rng.choice([1, 2])} hour(s) later and closes at {c + 1 if c < 23 else 23}:00.",
            f"The {name} store is closed on {rng.choice(['Nyepi', 'the first day of Lebaran', 'Christmas Day'])}.",
        ], f"what time does the {name} store open")
        pays = rng.sample(PAYMENTS, 4)
        add(f"store-{slug}-payment", "stores", [
            f"# Payment methods at {name}",
            f"The {name} store accepts {', '.join(pays[:-1])} and {pays[-1]}.",
            f"Split bills are supported at the {name} counter. Receipts can be sent to your email.",
        ], f"which payment methods work at {name}")
        add(f"store-{slug}-parking", "stores", [
            f"# Parking at {name}",
            f"Parking at {name} is {rng.choice(['free', 'free for the first two hours', 'paid at the building'])} for customers.",
            f"Motorbikes park at the front of the {name} store; cars use the {rng.choice(['basement', 'side lot', 'street outside'])}.",
            f"Valet service at {name} is {rng.choice(['available', 'not available'])} after 18:00.",
        ], f"is there parking at the {name} store")

    for p in PRODUCTS:
        slug = p.lower().replace(" ", "-")
        kcal = rng.randint(90, 650)
        add(f"product-{slug}", "menu", [
            f"# {p}",
            f"{p} is part of the KopiKu menu and is prepared to order. Sizes: small, regular and large.",
            f"A regular {p} has about {kcal} kcal. Ask for less sugar or extra shots at no charge.",
        ], f"how many calories are in {p}")
        al = rng.sample(ALLERGENS[:-1], rng.randint(1, 3))
        add(f"allergens-{slug}", "menu", [
            f"# Allergens in {p}",
            f"{p} contains {', '.join(al[:-1]) + ' and ' + al[-1] if len(al) > 1 else al[0]}.",
            f"The kitchen also handles other allergens, so cross contact with {p} cannot be excluded.",
        ], f"what allergens does {p} contain")

    for title, key, template in POLICIES:
        n, m = rng.randint(2, 14), rng.randint(2, 30)
        add(f"policy-{key}", "policies", [
            f"# {title}",
            template.format(n=n, m=m),
            "Terms may change. The latest version is always available in the KopiKu app under Help.",
        ], POLICY_QUESTIONS[key])
    return docs, evals


if __name__ == "__main__":
    d, e = build()
    print(len(d), "documents,", len(e), "questions")
    print(d[0]["text"])
