/**
 * To provide external url related helper methods
 */
const urlMetadata = require('url-metadata')
var messageUtils = require('./messageUtil')
var extUrlMessage = messageUtils.EXTERNAL_URL_META
var path = require('path')
var filename = path.basename(__filename)
var responseCode = messageUtils.RESPONSE_CODE
var respUtil = require('response_util')
var utilsService = require('../service/utilsService')
var logger = require('sb_logger_util_v2')
var dns = require('dns')
var ip = require('ip')

function fetchUrlMetaAPI (req, response) {
  return fetchUrlMeta(req, response)
}

function validateUrl(url, cb) {
  try {
    const urlObj = new URL(url)
    if (urlObj.protocol !== 'http:' && urlObj.protocol !== 'https:') {
      return cb(new Error('Invalid protocol'))
    }
    dns.lookup(urlObj.hostname, (err, address) => {
      if (err) {
        return cb(err)
      }
      if (ip.isPrivate(address) || ip.isLoopback(address) || address === '0.0.0.0' || ip.cidrSubnet('169.254.0.0/16').contains(address)) {
        return cb(new Error('Private IP access not allowed'))
      }
      cb(null, true)
    })
  } catch (e) {
    cb(new Error('Invalid URL'))
  }
}

function fetchUrlMeta (req, response) {
  var data = req.body.request
  var rspObj = {}
  if (!data['url']) {
    rspObj.errCode = extUrlMessage.FETCH.MISSING_CODE
    rspObj.errMsg = extUrlMessage.FETCH.MISSING_MESSAGE
    rspObj.responseCode = responseCode.CLIENT_ERROR
    logger.error({
      msg: 'Error due to missing url property in request',
      err: {
        errCode: rspObj.errCode,
        errMsg: rspObj.errMsg,
        responseCode: rspObj.responseCode
      },
      additionalInfo: {data}
    }, req)
    return response.status(400).send(respUtil.errorResponse(rspObj))
  }

  validateUrl(data.url, function (err, isValid) {
    if (err || !isValid) {
      rspObj.errCode = extUrlMessage.FETCH.FAILED_CODE
      rspObj.errMsg = 'Invalid URL or access denied'
      rspObj.responseCode = responseCode.CLIENT_ERROR
      logger.error({
        msg: 'Invalid URL or access denied',
        err: {
          err,
          errCode: rspObj.errCode,
          errMsg: rspObj.errMsg,
          responseCode: rspObj.responseCode
        },
        additionalInfo: {url: data.url}
      }, req)
      return response.status(400).send(respUtil.errorResponse(rspObj))
    }

    // using 'url-metadata'module fetch meta data of given web link and return response
    urlMetadata(data.url).then(
      function (metadata) {
        rspObj.result = metadata
        return response.status(200).send(respUtil.successResponse(rspObj))
      },
      function (error) {
        rspObj.errCode = error.code || extUrlMessage.FETCH.FAILED_CODE
        rspObj.errMsg = extUrlMessage.FETCH.FAILED_MESSAGE
        rspObj.responseCode = responseCode.INTERNAL_SERVER_ERROR
        logger.error({
          msg: 'Error while fetching meta data of the link',
          err: {
            error,
            errCode: rspObj.errCode,
            errMsg: rspObj.errMsg,
            responseCode: rspObj.responseCode
          },
          additionalInfo: {url: data.url}
        }, req)
        return response.status(500).send(respUtil.errorResponse(rspObj))
      })
  })
}
module.exports.fetchUrlMetaAPI = fetchUrlMetaAPI
