import type { PayloadRequest, UpdateGlobal } from 'payload'

import type { MongooseAdapter } from './index.js'

import { sanitizeInternalFields } from './utilities/sanitizeInternalFields.js'
import { sanitizeRelationshipIDs } from './utilities/sanitizeRelationshipIDs.js'
import { withSession } from './withSession.js'

export const updateGlobal: UpdateGlobal = async function updateGlobal(
  this: MongooseAdapter,
  { slug, data, req = {} as PayloadRequest },
) {
  const Model = this.globals
  const options = {
    ...(await withSession(this, req)),
    lean: true,
    new: true,
  }

  let result

  const sanitizedData = sanitizeRelationshipIDs({
    config: this.payload.config,
    data,
    fields: this.payload.config.globals.find((global) => global.slug === slug).fields,
  })

  result = await Model.findOneAndUpdate({ globalType: slug }, sanitizedData, options)

  result = JSON.parse(JSON.stringify(result))

  // custom id type reset
  result.id = result._id
  result = sanitizeInternalFields(result)

  return result
}
