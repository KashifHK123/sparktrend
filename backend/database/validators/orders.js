module.exports = {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['buyer_id', 'seller_id', 'insta_id', 'time', 'posts', 'price', 'total'],
      properties: {

        buyer_id: { bsonType: 'objectId' },

        seller_id : { bsonType: 'objectId' },

        insta_id: { bsonType: 'objectId' },

        category: {
          bsonType: 'string',
          maxLength: 1000
        },

        pricing_idx: {
          bsonType: 'int',
          minimum: 0,
          maximum: 1000
        },

        with_bio : { bsonType: 'bool' },

        bio_url: {
          bsonType: 'string',
          maxLength: 65535
        },

        swipe_up_url: {
          bsonType: 'string',
          maxLength: 65535
        },

        start_from: { bsonType: 'date' },

        caption: {
          bsonType: 'string',
          maxLength: 65535
        },

        additional_info: {
          bsonType: 'string',
          maxLength: 65535
        },

        posts: {
          bsonType: 'array',
          minItems: 1,
          maxItems: 100,
          items: {
            bsonType: 'string',
            maxLength: 65535
          }
        },

        time: {
          bsonType: 'int',
          minimum: 0
        },

        price: {
          minimum: 0
        },

        bio_price: {
          minimum: 0
        },

        charge: {
          minimum: 0
        },

        total: {
          minimum: 0
        },

        verfication_code: {
          bsonType: 'string',
          maxLength: 1000
        },

        history: {
          bsonType: 'object',
          properties: {
            created_at: { bsonType: 'date' },
            accepted_at: { bsonType: 'date' },
            started_at: { bsonType: 'date' },
            completed_at: { bsonType: 'date' },
            paid_at: { bsonType: 'date' },
            rejected_at: { bsonType: 'date' },
            refunded_at: { bsonType: 'date' },
          }
        },

        payment_method: {
          bsonType: 'string',
          maxLength: 1000
        },

        created_at: { bsonType: 'date' },

        updated_at: { bsonType: 'date' }
      }
    }
  }
}