const express = require('express');
const path = require('path');
const fs = require('fs');
const router = express.Router();
const { pool } =require('../modules/mysql-conn');
const moment = require('moment');
const { alert, imgExt } = require('../modules/utils');
const pager = require('../modules/pager')
const upload = require('../modules/multer-conn');

const imgSrc=(file)=>{
  if(imgExt.indexOf(path.extname(file).toLowerCase()) > -1){
    return '/storage/' + file.substr(0, 6) + '/' + file;
  }
  else return null;
}

router.get(['/', '/list', '/list/:page'], async(req, res, next)=>{
  let page = req.params.page ? Number(req.params.page) : 1;

  req.app.locals.page = page;
  // console.log(req.app.locals.page)

  // req.app.set('page', page);
  // console.log(req.app.get('page'));


  let pugVals = {cssFile : 'board', jsFile : 'board'};
  let connect, result, sql;
  // let allowExt = ['.jpg', '.jpeg', '.png', '.gif']

  try{
    connect = await pool.getConnection();
    sql = 'SELECT count(id) FROM board'; /* 전체 모든 레코드 개수 */
    result = await connect.query(sql);
    total = result[0][0]['count(id)'];
    pagerVals = pager({page, total, list:3, grp : 3});
    pugVals.pager = pagerVals;
    //console.log(result);
    // console.log(result[0][0]['count(id)']);

    sql = 'SELECT * FROM board ORDER BY id DESC LIMIT ?, ?';
    result = await connect.query(sql, [pagerVals.stIdx, pagerVals.list]);
    // console.log(result[0])
    connect.release();
    result[0].forEach((v)=>{
      v.created = moment(v.created).format('YYYY-MM-DD');
      // console.log('33');
      if(v.savename){
        v.src = imgSrc(v.savename);
      } 
      return v;
    });    

    // res.json(result[0]); // 확인용
    pugVals.lists = result[0];
    res.render('board/list', pugVals);
  }
  catch(e){
    connect.release();
    next(e);
  }
})
router.get('/write', (req, res, next)=>{
  const pugVals = {cssFile : 'board', jsFile : 'board'};
  res.render('board/write', pugVals);
})

router.get('/update/:id', async(req, res,next)=>{
  let pugVals = {cssFile : 'board', jsFile : 'board'};
  let connect, sql, result;
  sql = 'SELECT * FROM board WHERE id=' + req.params.id;
  try{
    connect = await pool.getConnection();
    result = await connect.query(sql);
    connect.release();
    pugVals.list = result[0][0];
    res.render('board/write', pugVals);
  }
  catch(e){
    connect.release();
    next(e);
  }
})

router.post('/save', upload.single('upfile'), async(req, res, next)=>{
  console.log(req.file);
  let {title, writer, comment, created=moment().format('YYYY-MM-DD HH:mm:ss')} = req.body;
  // const sql = 'INSERT INTO board SET title=?, writer=?, comment=?, created=now()'
  let sql = 'INSERT INTO board SET title=?, writer=?, comment=?, created=?';
  let values = [title, writer, comment, created];

  if(req.file){
    sql += ", oriname=?, savename=?"
    values.push(req.file.originalname);
    values.push(req.file.filename);
  }


  let connect , result;
  try{
    connect = await pool.getConnection();
    result = await connect.execute(sql, values);
    connect.release();
    // res.json(result);
    if(result[0].affectedRows > 0){
      if(req.fileCheck){
        res.send(alert(req.fileCheck + '은(는) 업로드 할 수 없습니다. 파일 이외의 내용은 저장되었습니다.', '/board'));
      }
      else{
        res.send(alert('저장되었습니다.', '/board')); // response redirect 대신 util로 location.href 처리
      }
    }
    else res.send(alert('에러가 발생하였습니다.', '/board'));  
  }
  catch(e){
    connect.release();
    console.log(e);
    next(e); // errorcode 전송
  }
})

router.post('/put', async(req, res, next)=>{
  let {title, writer, comment, id} = req.body;
  let values = [title, writer, comment, id];
  let sql = 'Update board SET title=?, writer=?, comment=? WHERE id=?';
  let connect , result;
  try{
    connect = await pool.getConnection();
    result = await connect.execute(sql, values);
    connect.release();
    // res.json(result);
    if(result[0].affectedRows > 0) res.send(alert('수정되었습니다.', '/board/list' + req.app.locals.page)); // response redirect 대신 util로 location.href 처리
    else res.send(alert('에러가 발생하였습니다.', '/board'));
  }
  catch(e){
    connect.release();
    console.log(e);
    next(e); // errorcode 전송
  }
});

router.get('/view/:id', async(req, res, next)=>{
  let id = req.params.id;
  let pugVals = {cssFile : 'board', jsFile : 'board'};
  let sql = 'SELECT * FROM board WHERE id=?';
  let connect, result;
  try{
    connect = await pool.getConnection();
    result = (await connect.query(sql, [id]))[0][0];
    connect.release();
    result.created = moment(result.crated).format('YYYY-MM-DD HH:mm:ss');

    // res.json(result);
    pugVals.data = result;

    if(pugVals.data.savename) pugVals.data.src = imgSrc(pugVals.data.savename);
    if(pugVals.data.savename) pugVals.data.file = pugVals.data.oriname;

    res.render('board/view.pug', pugVals);
  }
  catch(e){
    connect.release();
    next(e);
  }
})

router.get('/remove/:id', async(req, res, next)=>{
  let id = req.params.id;
  let sql = 'DELETE FROM board WHERE id=?'
  let connect, result;
  try{
    connect = await pool.getConnection();
    result = await connect.query(sql, [id]);
    connect.release;
    result[0].affectedRows == 1 ? res.send(alert('삭제되었습니다', '/board/list/' + req.app.locals.page)) : res.send(alert('삭제가 실행되지 않았습니다. 관리자에게 문의하세요', '/board'));
    // res.json(result);
    // res.redirect('/board/list');
  }
  catch(e){
    connect.release();
    // console.log(e);
    next(e);
  }
})

router.get('/download/:id', async(req, res, next)=>{
  const id = req.params.id;
  const sql = 'SELECT * FROM board WHERE id=' + id;
  let connect, result;
  try{
    connect = await pool.getConnection();
    result = await connect.query(sql);
    connect.release();
    let realfile = path.join(__dirname, '../upload', result[0][0].savename.substr(0, 6), result[0][0].savename);
    // console.log(realfile);
    res.download(realfile, result[0][0].oriname);
    // result[0][0].savename;
  }
  catch(e){
    connect.release();
    next(e);
  }
})

module.exports = router;