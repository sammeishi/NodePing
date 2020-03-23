document.addEventListener("deviceready", entry, false);

// document.addEventListener("DOMContentLoaded", entry, false);

/**
 * Ping显示精度：
 *  以2000毫米为最大值，超过2000不在计算
 *  测速结果在2000以内的百分比
 */
function entry() {
    new Vue({
        el: "#MAIN_CONTENT",
        data: {
            running: false,
            firstRunning: false,
            submitBtnClass: "el-icon-caret-right",
            SUSaveName: "_url_",
            subscribeUrl: "",
            isSubscribe: false,
            maxParallel: 10, //最大并行
            currHandle: null,
            limitSpeed: 2000, //测速最大速度，2000毫秒
            currCount: {
                err: 0,
                done: 0
            },
            serverList: [
                // { name:"1",server:"xxx",port:111,speed:10 }
            ]
        },
        mounted: function () {
            let keepUrl = localStorage.getItem(this.SUSaveName);
            if( keepUrl ){
                this.subscribeUrl = keepUrl;
            }
        },
        methods: {
            /**
             * 更新一个服务器的测试结果.
             */
            updateRes: function (id, status, speed) {
                let server = this.findServerById(id);
                //更新速度
                speed = status ? speed : this.limitSpeed;
                server.speed = speed;
                server.status = status;
                //测速成功，根据速度显示百分比
                status ? this.percentBg(id, Math.floor((speed / this.limitSpeed) * 100)) : null;
            },
            start: function () {
                if (this.running) {
                    return this.stop();
                }
                if (!this.subscribeUrl) {
                    alert("Url Empty");
                    return;
                }
                else{
                    localStorage.setItem(this.SUSaveName,this.subscribeUrl);
                }
                //加载订阅地址
                const that = this;
                this.isSubscribe = true;
                loadSubscribe(this.subscribeUrl, function (status, res) {
                    //取消订阅加载变量
                    that.isSubscribe = false;
                    //订阅成功，启动ping
                    if (status) {
                        //补充字段
                        for(let i = 0,n = res.length; i < n; i++){
                            res[i].id = i; //row id
                            res[i].speed = 0; //测速速度
                            res[i].status = true; //测速状态 true=成功 false=失败（超时等）
                        }
                        that.launcher(res);
                    }
                });
            },
            stop: function () {
                this.running = false;
                this.submitBtnClass = "el-icon-caret-right";
                if ( this.currHandle ) {
                    this.currHandle.abort();
                    this.currHandle = null;
                }
            },
            /**
             * 设置行分类
             * 根据状态增加 status
             */
            setRowClass:function( data ){
                return data.row.status ? "" : "disable";
            },
            /**
             * 表格排序
             * 重新渲染速度百分比背景
             */
            onSort: function () {
                let that = this;
                $('.el-table__row').removeClass('disable');
                setTimeout(function () {
                    for (let i = 0, n = that.serverList.length; i < n; i++) {
                        that.percentBg(that.serverList[i].id, Math.floor((that.serverList[i].speed / that.limitSpeed) * 100));
                    }
                }, 10)
            },
            /**
             * 设置一个服务器行的速度比例背景
             */
            percentBg: function (id, percent) {
                let colorDefine = {
                    "green": `linear-gradient(90deg, rgba(0,255,0,0.5) 0%, rgba(0,255,0,0.5) ${percent}%, rgba(255,255,255,1) ${percent}%)`,
                    "red": `linear-gradient(90deg, rgba(255,0,0,0.1) 0%, rgba(255,0,0,0.1) ${percent}%, rgba(255,255,255,1) ${percent}%)`,
                    "blue": `linear-gradient(90deg, rgba(0,251,252,0.3) 0%, rgba(0,251,252,0.3) ${percent}%, rgba(255,255,255,1) ${percent}%)`,
                };
                let color = "none";
                if (percent < 15) {
                    color = colorDefine.green;
                } else if (percent < 50) {
                    color = colorDefine.blue;
                } else {
                    color = colorDefine.red;
                }
                this.findEleById(id).css('background', color);
            },
            /**
             * 根据id查找
             */
            findServerById: function (id) {
                for (let i = 0, n = this.serverList.length; i < n; i++) {
                    if (this.serverList[i].id === id) {
                        return this.serverList[i];
                    }
                }
                return null;
            },
            /**
             * 格局id查找对应行元素
             */
            findEleById: function (id) {
                return $('#row_mark_' + id).parent().parent().parent();
            },
            /**
             * 批量ping
             */
            launcher: function (serverList) {
                this.currCount.err = 0;
                this.currCount.done = 0;
                this.running = true;
                this.firstRunning = true;
                this.submitBtnClass = "el-icon-close";
                this.serverList = serverList;
                //批量ping
                const that = this;
                this.currHandle = BatchPing(
                    this.serverList, this.maxParallel, this.limitSpeed,
                    function onEachDone(status, id, speed) {
                        !status ? that.currCount.err++ : null;
                        that.currCount.done++;
                        that.updateRes(id, status, speed);
                    },
                    this.stop.bind(this)
                );
            }
        }
    });
}

/**
 * 加载订阅，解析出规则
 */
function loadSubscribe(url, cb) {
    let parser = {
        "clash": function (data) {
            try{
                let res = jsyaml.load(data);
                if (!_.has(res, "Proxy") || !_.isArray(res['Proxy']) || res['Proxy'].length === 0) {
                    return false;
                } else {
                    return res['Proxy'];
                }
            }
            catch (e) {
                alert('clash parser error !  not yaml??? ');
                return false;
            }
        }
    };
    $.ajax({
        url,
        cache: false,
        type: "GET",
        dataType: "text",
        success: function (data) {
            if (!data ) {
                alert('subscribe url response empty!');
                return cb(false);
            }
            let serverList = parser.clash( data );
            if (!serverList || !_.isArray(serverList) || serverList.length === 0 ) {
                return cb(false);
            }
            return cb(true, serverList);
        },
        error: function (jqXHR, textStatus) {
            alert("Can not access " + url + " " + textStatus);
            return cb(false);
        }
    });
}

/**
 * 批量Ping.
 * 返回包含停止的控制器.
 */
function BatchPing(serverList, maxParallel, timeout, onEachDone, onFinish) {
    let isExit = false, doneCount = 0, currIndex = 0, currTask = [];

    /**
     * socket ping.
     * 回调（ 是否ping通，耗时 ）
     * backArg: 回调自定义参数
     */
    function socketTest(address, port, timeout, customArgs, cb) {
        let socket = new Socket(),isExist = false,timer = null, beginTime = +new Date();
        //计算耗时
        function usedTime() {
            return +new Date() - beginTime;
        }
        //停止
        function end(){
            isExist = true;
            socket ? socket.close() : null;
            socket = null;
            clearTimeout( timer );
        }
        //成功
        function success() {
            if (!isExist) {
                end();
                cb(true, customArgs, usedTime());
            }
        }
        //发生错误
        function error() {
            if (!isExist) {
                end();
                cb(false, customArgs);
            }
        }
        /**
         * 超时检测
         */
        timer = setTimeout(error, timeout);
        /**
         * 开始执行socket ping
         */
        socket.onClose =  () => {}; //仅socket类需要
        socket.open(address, port, success, error);
        /**
         * 返回操作实例
         */
        return { abort:end };
    }

    /**
     * 开启下一个任务。
     * 有当前任务回调触发,每次只开启一个.
     */
    function nextTask() {
        //已经全部开启过，无法开启
        if ((currIndex) >= serverList.length) {
            return false;
        }
        //开启新的
        let info = serverList[currIndex++];
        currTask.push(socketTest(info.server, info.port, timeout, info.id, function (s, id, speed) {
            if (!isExit) {
                //回报统计++
                doneCount++;
                //不管三七二十一，只要每个结束立即开启下个
                nextTask();
                //回调通知
                onEachDone(s, id, speed);
                //如果完成测试数量等于服务器数量，则完成
                if (doneCount >= serverList.length) {
                    isExit = true;
                    return onFinish();
                }
            }
        }));
    }

    /**
     * 初始开启任务
     */
    let startNum = maxParallel;
    if (startNum >= serverList.length) {
        startNum = serverList.length;
    }
    while (startNum--) {
        nextTask();
    }
    /*
    * 返回对外控制器
    * */
    return {
        abort: function () {
            isExit = true;
            for (let i = 0; i < currTask.length; i++) {
                currTask[i].abort();
                currTask = [];
            }
        }
    };
}
