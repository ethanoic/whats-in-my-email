import Imap from 'node-imap'
import { inspect } from 'util'
import * as dotennv from 'dotenv'
import fs from 'fs'

dotennv.config()

const imapClient = new Imap({
  user: process.env.USER,
  password: process.env.PASSWORD,
  host: process.env.HOST,
  port: process.env.PORT,
  tls: process.env.TLS_ENABLED
})

const replacerFunc = () => {
  const visited = new WeakSet();
  return (key, value) => {
    if (typeof value === "object" && value !== null) {
      if (visited.has(value)) {
        return;
      }
      visited.add(value);
    }
    return value;
  };
};

const getBoxes = () => {
  imapClient.getBoxes((err, boxes) => {
    if (err) throw err

    fs.writeFileSync('./data/boxes.json', JSON.stringify(boxes, replacerFunc()))

    // for each box, open it
  })
}

const openInBox = (cb) => {
  imapClient.openBox('INBOX', true, cb)
}

imapClient.once('ready', () => {
  getBoxes();
  openInBox((err, box) => {
    if (err) throw err

    console.log(`Box has ${box.messages.total} messages`)

    const f = imapClient.seq.fetch('1:3', {
      bodies: 'HEADER.FIELDS (FROM TO SUBJECT DATE)',
      struct: true
    })

    f.on('message', (msg, seqno) => {
      console.log('Message #%d', seqno)
      const prefix = `(# ${seqno})`
      
      msg.on('body', (stream, info) => {
        var buffer = '';
        stream.on('data', (chunk) => {
          buffer += chunk.toString('utf8')
        })
        stream.once('end', () => {
          console.log(prefix + 'Parsed header: %s', inspect(Imap.parseHeader(buffer)))
        })
      })

      msg.once('attributes', (attrs) => {
        console.log(prefix + 'Attributes: %s', inspect(attrs, false, 8))
      })

      msg.once('end', () => {
        console.log(prefix + 'Finished')
      })
    })

    f.once('error', (err) => {
      console.log('Fetch error: ' + err)
    })

    f.once('end', () => {
      console.log('Done fetching all messages!')
      imapClient.end()
    })
  })
})

imapClient.once('error', (err) => {
  console.log(err)
})

imapClient.once('end', () => {
  console.log('Connection ended')
})

imapClient.connect()