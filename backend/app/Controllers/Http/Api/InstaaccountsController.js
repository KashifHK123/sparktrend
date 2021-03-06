'use strict'
/** @typedef {import('@adonisjs/framework/src/Request')} Request */
/** @typedef {import('@adonisjs/auth/src/Schemes/Session')} AuthSession */
const BaseController = require('./BaseController')
/** @type {typeof import('../../../Models/Instaaccount')} */
const Instaaccount = use('App/Models/Instaaccount')
const UnAuthorizeException = use('App/Exceptions/UnAuthorizeException')
const randomstring = require('randomstring')
const { $n, $h } = require('../../../Helpers')
const util = require('util')
const Drive = use('Drive')
/**
 *
 * @class InstaaccountsController
 */
class InstaaccountsController extends BaseController {

  /**
   * Index
   *
   * @param {object} ctx
   * @param {AuthSession} ctx.auth
   * @param {Request} ctx.request
   * @param {Response} ctx.response
   */
  async index ({ request, response, auth }) {

    const parsedQuery = this.buildProductQuery(request)
    const queryBuilder = Instaaccount.query()
      .where(parsedQuery.where)
      .where({ allowed: true })
      .where({ product: { $exists: true } })
      .skip(parsedQuery.skip)
      .limit(parsedQuery.limit)

    let isAdmin = false
    try {
      let user = auth.user
      if (user.role === 'admin') {
        isAdmin = true
      }
    } catch (e) {
      isAdmin = false
    }
    let instaaccounts
    if (!isAdmin) {
      instaaccounts = await queryBuilder.fetch()
      instaaccounts.rows.forEach(account => {
        account.username = $h(account.username)
      })
    } else {
      instaaccounts = await queryBuilder.with('user').fetch()
    }

    const total = await Instaaccount
      .query()
      .where(parsedQuery.where)
      .where({ allowed: true })
      .count()
    return response.apiCollection(instaaccounts, { total })
  }

  async products ({ request, response, auth }) {
    return this.index({ request, response })
  }

  /**
   * Show
   *
   * @param {object} ctx
   * @param {AuthSession} ctx.auth
   * @param {Request} ctx.request
   * @param {Response} ctx.response
   */
  async show ({ request, instance, response }) {
    const instaaccount = instance
    let showFullname = false
    try {
      let user = auth.user
      if (user.role === 'admin') {
        showFullname = true
      }
      if (user._id === instaaccount.user_id) {
        showFullname = true
      }
    } catch (e) {
      showFullname = false
    }
    if (!showFullname) {
      instaaccount.username = instaaccount.username.slice(0, 3) + '******'
    }
    return response.apiItem(instaaccount)
  }

  async create ({ request, auth, response }) {
    const user = auth.user
    const username = request.input('username')
    // check if an account already registered with given username
    const verfiedAccountExists = await Instaaccount.where({ verified: true }).where({ username }).count()
    if (verfiedAccountExists) {
      return response.validateFailed('instagram_already_exists')
    }
    let appliedAccountExists = await Instaaccount.where({ username: username })
      .where({ user_id: user._id })
      .count()
    if (appliedAccountExists) {
      return response.validateFailed('instagram_already_exists')
    }
    const instainfo = await this.getInstaInfo(username)
    if (!instainfo) {
      return response.apiFail('cannot_get_instagram_account')
    }
    const config = await this.getSiteConfig()
    if (instainfo.follower_count < config['seller']['minimum_followers']) {
      return response.validateFailed('insufficient_followers')
    }
    const instaaccount = new Instaaccount({
      user_id: user._id,
      username,
      verified: false,
      verification_code: randomstring.generate(7)
    })
    instaaccount.merge(instainfo)
    await instaaccount.save()
    return response.apiCreated(instaaccount)
  }

  // async registerInstagram({ request, auth, instance, response }) {
  //   const user = auth.user
  //   let instaaccount = instance
  //
  //   if (user.role != 'admin' && user._id.toString() != instance.user_id.toString()) {
  //     throw UnAuthorizeException.invoke()
  //   }
  //   const instainfo = await this.getInstaInfo(instaaccount.username)
  //   if (instaaccount.verified && instainfo.follower_count) {
  //
  //   } else {
  //     if (!instainfo) {
  //       return response.validateFailed('no_such_account')
  //     }
  //     if (instainfo.follower_count < 10000) {
  //       return response.validateFailed('insufficient_followers')
  //     }
  //     if (!instaaccount.verfication_code) {
  //       instaaccount.verification_code = randomstring.generate(7)
  //     }
  //   }
  //   if (instainfo) {
  //     instaaccount.follower_count = instainfo.follower_count
  //     instaaccount.profile_img = instainfo.profile_img
  //     instaaccount.type = instainfo.type
  //   }
  //   await instaaccount.save()
  //   instaaccount.merge(instainfo)
  //   return response.apiUpdated(instaaccount)
  // }

  async validateInstagram ({ request, auth, response, instance }) {
    const user = auth.user
    let instaaccount = instance
    if (user.role != 'admin' && user._id.toString() != instance.user_id.toString()) {
      throw UnAuthorizeException.invoke()
    }
    const isValid = await this.validateInsta(instaaccount.username, instaaccount.verification_code)
    if (isValid) {
      instaaccount.verified = true
      await instaaccount.save()
      return response.apiUpdated(instaaccount)
    } else {
      return response.validateFailed('insta_verification_failed')
    }
  }

  async uploadInsights ({ request, auth, instance, response }) {
    const user = auth.user
    let instaaccount = instance

    if (user.role !== 'admin' && user._id.toString() != instance.user_id.toString()) {
      throw UnAuthorizeException.invoke()
    }
    const image = request.file('image', {
      maxSize: '5mb',
      allowedExtensions: ['jpg', 'png', 'jpeg']
    })
    const fileName = `${use('uuid').v1().replace(/-/g, '')}_${image.clientName}`
    const filePath = `uploads/image/insights/${instaaccount._id.toString()}`
    await image.move(use('Helpers').publicPath(filePath), { name: fileName })
    instaaccount.insights_picture = this.baseUrl() + `/${filePath}/${fileName}`
    const s3Url = await Drive.disk('s3').put(`${filePath}/${fileName}`, Drive.disk('local').getStream(`${filePath}/${fileName}`))
    instaaccount.insights_picture = s3Url
    await Drive.disk('local').delete(`${filePath}/${fileName}`)
    await instaaccount.save()
    return response.apiUpdated(instaaccount)
  }

  async adminList ({ request, auth, instance, response }) {
    const parsedQuery = this.buildAdminQuery(request)
    const instaaccounts = await Instaaccount.query()
      .with('user')
      .where(parsedQuery.where)
      .skip(parsedQuery.skip)
      .limit(parsedQuery.limit)
      .fetch()
    const total = await Instaaccount.query()
      .where(parsedQuery.where)
      .count()
    return response.apiCollection(instaaccounts, { total })
  }

  async adminShow ({ request, auth, instance, response }) {
    instance.user_info = await instance.user().fetch()
    return response.apiItem(instance)
  }

  async adminEdit ({ request, auth, instance, response }) {
    const user = auth.user
    if (user.role !== 'admin') {
      throw UnAuthorizeException.invoke()
    }
    let instaaccount = instance
    const editData = request.only(['allowed', 'verified', 'product'])
    instaaccount.merge(editData)
    if (!request.demographics || typeof request.demographics !== 'object') {
      instaaccount.demographics = {
        age: [
          { name: '13-17', percent: 0 },
          { name: '18-24', percent: 0 },
          { name: '25-34', percent: 0 },
          { name: '35-44', percent: 0 },
          { name: '45-54', percent: 0 },
          { name: '55-64', percent: 0 },
          { name: '65+', percent: 0 }
        ],
        gender: [
          { name: 'Men', percent: 0 },
          { name: 'Women', percent: 0 }
        ],
        country: [
          { name: ' ', percent: 0 },
          { name: '  ', percent: 0 },
          { name: '   ', percent: 0 },
          { name: '    ', percent: 0 },
          { name: '     ', percent: 0 }
        ]
      }
    } else {
      ['age', 'gender', 'country'].forEach(key => {
        if (request.demographics[key] && request.demographics[key].length) {
          instaaccount.demographics[key] = request.demographics[key]
        } else {
          if (key === 'age') {
            instaaccount.demographics[key] = [
              { name: '13-17', percent: 0 },
              { name: '18-24', percent: 0 },
              { name: '25-34', percent: 0 },
              { name: '35-44', percent: 0 },
              { name: '45-54', percent: 0 },
              { name: '55-64', percent: 0 },
              { name: '65+', percent: 0 }
            ]
          }
          if (key === 'gender') {
            instaaccount.demographics[key] = [
              { name: 'Men', percent: 0 },
              { name: 'Women', percent: 0 }
            ]
          }
          if (key === 'country') {
            instaccount.demographics[key] = [
              { name: ' ', percent: 0 },
              { name: '  ', percent: 0 },
              { name: '   ', percent: 0 },
              { name: '    ', percent: 0 },
              { name: '     ', percent: 0 }
            ]
          }
        }
      })
    }
    if (!instaaccount.verified && instaaccount.allowed) {
      instaaccount.allowed = false
    }
    try {
      await instaaccount.save()
    } catch (e) {
      console.log(instaaccount.demographics)
      // console.log(instaaccount)
      // console.log(util.inspect(instaaccount, false, null, true))
      // console.error(e)
      return response.validateFailed('invalid_data')
    }

    return response.apiUpdated(instaaccount)
  }

  async storeProduct ({ request, auth, instance, response }) {
    const user = auth.user
    let instaaccount = instance
    if (user.role !== 'admin' && user._id.toString() != instance.user_id.toString()) {
      throw UnAuthorizeException.invoke()
    }
    let productData = request.only(['description', 'banner_img', 'niches', 'categories'])
    instaaccount.product = productData
    try {
      await instaaccount.save()
    } catch (e) {
      console.log(util.inspect(instaaccount, false, null, true))
      return response.apiFail(e, 'product_save_failed')
    }
    return response.apiUpdated(instaaccount)
  }

  async delete ({ request, auth, instance, response }) {
    const user = auth.user
    let instaaccount = instance
    if (user.role !== 'admin' && user._id.toString() != instance.user_id.toString()) {
      throw UnAuthorizeException.invoke()
    }
    await instaaccount.delete()
    return response.apiDeleted()
  }

  async deleteProduct ({ request, auth, instance, response }) {
    const user = auth.user
    let instaaccount = instance
    if (user.role !== 'admin' && user._id.toString() != instance.user_id.toString()) {
      throw UnAuthorizeException.invoke()
    }
    instaaccount.product = null
    await instaaccount.save()
    return response.apiDeleted(instaaccount)
  }

  async related({ request, instance, response }) {
    let instaaccounts = []
    if(instance.product) {
      instaaccounts = Instaaccount.where({
        verified: true,
        allowed: true,
        product: { $exists: true },
        "product.niches": instance.product.niches
      }).orderBy({
        completed_shoutout: -1
      }).limit(3).fetch()
    }
    return response.apiCollection(instaaccounts)
  }

  async myproducts ({ request, auth, response }) {
    const user = auth.user
    return response.apiCollection(await user.instaaccounts().fetch())
  }

  async getInstaInfo (username) {
    try {
      const req = require('request-promise')
      const instaresp = await req(`https://www.instagram.com/${username}/?__a=1`)
      const instadata = JSON.parse(instaresp)
      const userdata = instadata.graphql.user
      return {
        follower_count: userdata.edge_followed_by.count,
        username: userdata.username,
        profile_img: userdata.profile_pic_url,
        type: userdata.is_business_account ? 'business' : 'personal',
        biography: userdata.biography
      }
      // const instainfo = await setTimeout(function() {
      //   return {
      //     follower_count: 539470,
      //     username: 'twicesana',
      //     profile_img: "https://scontent-lax3-1.cdninstagram.com/v/t51.2885-19/s150x150/71601314_2511674429113634_1071411099867283456_n.jpg?_nc_ht=scontent-lax3-1.cdninstagram.com&_nc_ohc=kXIMk54aME4AX9hK8PW&oh=7571e1e74e2af150160e9c2962ee99f4&oe=5EC2DA4A",
      //     type: 'business'
      //   }
      // }, 10)
      // return {
      //   follower_count: 539470,
      //   username: 'twicesana',
      //   profile_img: "https://scontent-lax3-1.cdninstagram.com/v/t51.2885-19/s150x150/71601314_2511674429113634_1071411099867283456_n.jpg?_nc_ht=scontent-lax3-1.cdninstagram.com&_nc_ohc=kXIMk54aME4AX9hK8PW&oh=7571e1e74e2af150160e9c2962ee99f4&oe=5EC2DA4A",
      //   type: 'business'
      // }
    } catch (e) {
      return null
    }
  }

  async validateInsta (username, code) {
    const instainfo = await this.getInstaInfo(username)
    return instainfo.biography.includes(code)
  }

  randomIntBetween (min, max) {
    return parseInt(Math.random() * (max - min) + min)
  }

  buildProductQuery (request) {
    const length = 20 // page length is 20

    // --- begin retrieve page ---
    let page = $n(request.input('page'), 1)
    if (page < 1) page = 1
    const skip = (page - 1) * length
    const limit = length
    // ---  end retrieve page  ---

    // --- begin retrieve price query ---
    let minPrice = $n(request.input('lp'), -1)
    let maxPrice = $n(request.input('hp'), -1)
    if (minPrice < 0) minPrice = null
    if (maxPrice < 0) minPrice = null

    // ---  end retrieve price query  ---

    // --- begin retrieve gender ---
    let gender = request.input('g')
    if (gender) gender = gender.toLowerCase()

    if (gender !== 'male' && gender !== 'female') {
      gender = null
    }
    // ---  end retrieve gender  ---

    // --- begin retrieve country ---
    let countries = request.input('c')
    if (countries) {
      countries = countries.split(':')
    } else {
      countries = null
    }
    // ---  end retrieve country  ---

    // --- begin retrieve niches ---
    let niches = request.input('n')
    if (niches) {
      niches = niches.split(':')
      niches.forEach((nich, index) => {
        niches[index] = nich.replace('_', ' & ')
      })
    } else {
      niches = null
    }
    // ---  end retrieve niches  ---

    // --- begin retrieve categories ---
    let categories = request.input('cat')
    if (categories) {
      categories = categories.split(':')
    } else {
      categories = null
    }
    // ---  end retrieve categories  ---

    // --- begin retrieve username ---
    let username = request.input('u')
    // ---  end retrieve username  ---

    // --- begin build where ---
    const where = {}
    if (minPrice || maxPrice) {
      if (minPrice) {
        where['product.categories'] = { $elemMatch: { 'pricing.price': { $gt: minPrice } } }
      }
      if (maxPrice) {
        where['product.categories'] = { $elemMatch: { 'pricing.price': { $lt: maxPrice } } }
      }
    }
    if (gender) {
      if (gender === 'female') {
        where['demographics.gender'] = { $elemMatch: { name: 'Women', percent: { $gt: 50 } } }
      } else {
        where['demographics.gender'] = { $elemMatch: { name: 'Men', percent: { $gt: 50 } } }
      }
    }
    if (countries) {
      where['demographics.country'] = { $elemMatch: { name: { $in: countries } } }
    }
    if (niches) {
      where['product.niches'] = { $in: niches }
    }
    if (categories) {
      where['product.categories'] = { $elemMatch: { type: { $in: categories } } }
    }
    if (username) {
      where['username'] = { $regex: `.*${username}.*` }
    }
    // ---  end build where  ---
    // finally

    return { skip, limit, where }
  }

  buildAdminQuery (request) {
    const length = 20
    let page = $n(request.input('page'), 1)
    if (page < 1) page = 1
    const skip = (page - 1) * length
    const limit = length

    const where = {}

    return { skip, limit, where }
  }

}

module.exports = InstaaccountsController
