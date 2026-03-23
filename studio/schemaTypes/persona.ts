import {defineType, defineField} from 'sanity'

export const persona = defineType({
  name: 'persona',
  title: 'Persona Journey',
  type: 'document',
  fields: [
    defineField({name: 'title', title: 'Title', type: 'string', validation: (r) => r.required()}),
    defineField({name: 'slug', title: 'Slug', type: 'slug', options: {source: 'title'}}),
    defineField({name: 'prompt', title: 'Original Prompt', type: 'text'}),
    defineField({name: 'emoji', title: 'Emoji', type: 'string'}),
    defineField({name: 'heroTitle', title: 'Hero Title', type: 'string'}),
    defineField({name: 'heroDesc', title: 'Hero Description', type: 'text'}),
    defineField({name: 'scenarioEmoji', title: 'Scenario Emoji', type: 'string'}),
    defineField({name: 'scenarioTitle', title: 'Scenario Title', type: 'string'}),
    defineField({name: 'scenarioText', title: 'Scenario Text', type: 'text'}),
    defineField({
      name: 'context',
      title: 'Context Cards',
      type: 'array',
      of: [
        {
          type: 'object',
          fields: [
            defineField({name: 'title', title: 'Title', type: 'string'}),
            defineField({name: 'items', title: 'Items', type: 'array', of: [{type: 'string'}]}),
          ],
        },
      ],
    }),
    defineField({
      name: 'stages',
      title: 'Journey Stages',
      type: 'array',
      of: [
        {
          type: 'object',
          fields: [
            defineField({name: 'heading', title: 'Heading', type: 'string'}),
            defineField({name: 'subtitle', title: 'Subtitle Quote', type: 'string'}),
            defineField({
              name: 'cards',
              title: 'Cards',
              type: 'array',
              of: [
                {
                  type: 'object',
                  fields: [
                    defineField({name: 'icon', title: 'Icon Emoji', type: 'string'}),
                    defineField({name: 'title', title: 'Title', type: 'string'}),
                    defineField({name: 'items', title: 'Items', type: 'array', of: [{type: 'string'}]}),
                    defineField({
                      name: 'style',
                      title: 'Style',
                      type: 'string',
                      options: {list: ['default', 'highlight', 'action', 'full']},
                    }),
                  ],
                },
              ],
            }),
            defineField({name: 'quote', title: 'Quote', type: 'text'}),
            defineField({name: 'feelings', title: 'Feelings', type: 'array', of: [{type: 'string'}]}),
            defineField({name: 'actions', title: 'Actions', type: 'array', of: [{type: 'string'}]}),
            defineField({name: 'interactions', title: 'Interactions', type: 'array', of: [{type: 'string'}]}),
            defineField({name: 'painpoints', title: 'Pain Points', type: 'array', of: [{type: 'string'}]}),
            defineField({name: 'improvements', title: 'Improvements', type: 'array', of: [{type: 'string'}]}),
            defineField({name: 'outcome', title: 'Outcome', type: 'string'}),
          ],
        },
      ],
    }),
    defineField({name: 'closeStatement', title: 'Close Statement', type: 'text'}),
    defineField({
      name: 'metrics',
      title: 'Metrics',
      type: 'array',
      of: [
        {
          type: 'object',
          fields: [
            defineField({name: 'value', title: 'Value', type: 'string'}),
            defineField({name: 'label', title: 'Label', type: 'string'}),
          ],
        },
      ],
    }),
  ],
})
