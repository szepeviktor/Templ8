	var U, DEBUG = 'DEBUG', RESERVED = '__ASSERT__ __CONTEXT__ __FILTER_ __OUTPUT__ __UTIL__ $_ document false global instanceof null true typeof undefined window'.split( ' ' ).reduce( function( o, k ) {
			o[k] = true; return o;
		}, util.obj() ),
		ba          = {
			blank      : function( o ) { return util.empty( o ) || ( typeof o == 'string' && !o.trim() ); },
			contains   : contains,
			endsWith   : function( s, str ) {
				s = String( s );
				var n = s.length - str.length;
				return n >= 0 && s.lastIndexOf( str ) == n;
			},
			empty      : util.empty,
			equals     : function( o, v )   { return o == v },
			exists     : util.exists,
			is         : function( o, v )   { return o === v },
			isEven     : function( i )      { return  !( parseInt( i, 10 ) & 1 ); },
			isOdd      : function( i )      { return !!( parseInt( i, 10 ) & 1 ); },
			isTPL      : function( id )     { return !!getTPL( id, this ); },
			iterable   : function( o )      { return util.iter( o ); },
			notEmpty   : not_empty,
			startsWith : function( s, str ) { return String( s ).indexOf( str ) === 0; }
		},
		bf = {}, bu = {
			inspect    : function( v ) {
				switch ( util.ntype( v ) ) {
					case 'object' :
					case 'array'  : console.dir( v ); break;
					default       : console.log( v );
				}
				return '';
			},
			objectify  : function( v, k ) { var o = {}; o[k] = v; return o; },
			parse      : function( o, id, tpl ) {
				var e, p, s, t; o = Object( o ); // this fixes an issue in WebKit nightly — 6.0.2 (8536.26.17, 537+) —
										   // which does not allow you to set a property on a primitive value

				if ( id instanceof __Class__ )
					t  = id;
				else {
					id = String( id ).trim();
					t  = getTPL( id, this );
				}

				if ( !t ) return this.fallback;

				p = this[fn_var.dict];

				e = fn_var.parent in p;

				while( p && p === p[fn_var.parent] )
					p = p[fn_var.parent];

				if ( o !== p )
					o[fn_var.parent] = p;

				s = t.parse( o );

				if ( e )
					o[fn_var.parent] = p[fn_var.parent];
				else
					delete o[fn_var.parent];

				return s;
			},
			stop       : function( iter ) { iter.stop(); },
			stringify  : stringify,
			type       : function( o, match ) {
				var type = util.type( o );
				return typeof match == 'string' ? type == match : type;
			},
			value      : function( o, key ) { return Object.value( o, key ); }
		},
		cache_key = '__tpl_cs_cached_keys',                         cache_stack = '__tpl_cs_stack',
		defaults  = 'compiled debug dict fallback id sourceURL'.split( ' ' ), delim       = '<~>',
		esc_chars = /([-\*\+\?\.\|\^\$\/\\\(\)[\]\{\}])/g,          esc_val     = '\\$1',

		fn_var    = { assert : '__ASSERT__', ctx : '__CONTEXT__', dict : '__dict__', filter : '__FILTER__', output : '__OUTPUT__', parent : '__PARENT__', util : '__UTIL__' },
		fn_end    = util.format( 'return {0};\n ', fn_var.output ),
		fn_start  = '\n"use strict";\n' + util.format( 'var $C = new ContextStack( {0}, this ), $_ = $C.current(), iter = new Iter( null ), {1} = "", U;', fn_var.ctx, fn_var.output ),

		id_count  = 999, internals, logger = 'console', // <= gets around jsLint

		re_br              = /[\n\r]/gm,                      re_esc                = /(['"])/g,
		re_fix_jscomments  = /(\*)(\/)/gm,                    re_format_delim       = new RegExp( delim, 'gm' ),
		re_new_line        = /[\r\n]+/g,                      re_space              = /\s+/g,
		re_special_char    = /[\(\)\[\]\{\}\?\*\+\/<>%&=!-]/, re_split_tpl,
		re_statement_fix   = /\.(\d+)(\.?)/g,                 re_statement_replacer = "['$1']$2",
		re_statement_split = new RegExp( '\\s*([^\\|]+(?:\\|[^\\|]+?)){0,}' + delim, 'g' ),

		split_token        = '<__SPLIT__TEMPLATE__HERE__>',     split_replace         = ['', '$1', '$2', ''].join( split_token ),

		tpl           = {}, tpl_compiled  = '\/{0}{0} original template string:\n\n{1}\n\n{0}\/\n\n\/\/ compiled template code: \n\n{2}\n\n\/\/@ sourceURL={3}\n',
		tpl_debug     = 'WARNING: NO VALUE FOUND FOR => {0}',   tpl_id  = 't8-anon-{0}', tpl_srcurl = '/Templ8/{0}\.tpl',
		tpl_statement = '{0}["{1}"].call( this, {2}{3}, {4} )', tpl_sub = '{0}.{1}';

/*** START: Utility Functions ***/
	function contains( o, k ) { return o && ( typeof o.indexOf == 'function' && !!~o.indexOf( k ) ) || util.got( o, k ) ; }

	function escapeRE( s ) { return String( s ).replace( esc_chars, esc_val ); }

	function getTPL( id, ref_tpl ) {
		if ( !ref_tpl )
			return tpl[id] || null;

		var _id;

		do {
			_id = util.format( tpl_sub, ref_tpl.id, id );

			if ( _id in tpl )
				return tpl[_id];

		} while( ref_tpl = ref_tpl.parentTemplate );

		return tpl[id] || null;
	}

	function is_obj( o ) { return typeof o == 'object' && ( o.constructor === Object || o.constructor === U ); }

	function mapc( a, fn, ctx ) {
		fn || ( fn = util ); ctx || ( ctx = a );
		var i = -1, l = a.length, res = [], v;
		while ( ++i < l ) {
			v = fn.call( ctx, a[i], i, a );
			switch ( v ) {
				case null : case U : break;
				default   : switch ( typeof v ) {
					case 'string' :    v.trim() === '' || res.push( v );                    break;
					case 'number' :    isNaN( v )      || res.push( v );                    break;
					default       : ( !util.iter( v )  || util.len( v ) ) || res.push( v ); break;
				}
			}
		}
		return res;
	}

	function not_empty( o ) { return !util.empty( o ); }
/*** END:   Utility Functions ***/

/*** START: Classes used by compiled templates ***/
	function ContextStack( dict, tpl ) {
		this[cache_stack] = [];
		this.tpl = tpl;
		this.push( util.global );

		if ( tpl.fallback !== U ) {
			this.hasFallback = true;
			this.fallback    = tpl.fallback;
		}

		switch( util.ntype( dict ) ) {
			case 'object' : this.push( dict );
							break;
			case 'array'  : dict[fn_var.dict]
						  ? dict.map( this.push, this ) : this.push( dict );
						  	break;
			default       : !util.exists( dict ) || this.push( dict );
		}
	}

	ContextStack.prototype = {
		current : function ContextStack_current() { return ( this.top || this[cache_stack][0] ).dict; },
		get     : function ContextStack_get( key ) {
			var ctx, fb = this.fallback, stack = this[cache_stack], l = stack.length, val;

			while ( l-- ) {
				ctx = stack[l];
				if ( key in ctx.cache ) return ctx.cache[key];
				if ( ( val = ctx.dict[key] ) !== U || ( val = Object.value( ctx.dict, key ) ) !== U )
					return ctx.cache[key] = val;
			}

			if ( this.hasFallback ) switch ( util.ntype( fb ) ) {
				case 'string'   : return fb === DEBUG ? util.format( tpl_debug, key ) : fb;
				case 'function' : return fb( key, ctx.dict );
			}

			return U;
		},
		pop     : function ContextStack_pop() {
			var dict = this[cache_stack].pop().dict;
			this.top = this[cache_stack][this[cache_stack].length - 1];
			return dict;
		},
		push    : function ContextStack_push( dict ) {
			this[cache_stack].push( this.top = { cache : util.obj(), dict : dict } );
			return this;
		}
	};

	function Iter( iter, parent, start, count ) {
		var keys = Object.keys( iter = this._ = Object( iter ) ),
			len  = keys.length;

		if ( !len ) return this.stop();

		util.tostr( iter ) == '[object Object]' || ( keys = keys.map( Number ) );

		this.empty     = false;
		this.count     = isNaN( count ) ? len : count < 0 ? len + count : count > len ? len : count;
		if ( start == 0 || isNaN( start ) ) {
			this.firstIndex =  0;
			this.index      = -1;
		}
		else {
			this.firstIndex = start;
			this.index      = start - 2;
		}
		this.index1    = this.index + 1;
		this.lastIndex = this.count === len ? this.count - 1 : this.count;
		this.keys      = keys;

		!( parent instanceof Iter ) || ( this.parent = parent );
	}

	Iter.prototype = {
		empty   : true,

		hasNext : function Iter_hasNext() {
			if ( this.stopped || this.empty ) return false;
			++this.index < this.lastIndex || ( this.stop().isLast = true );

			this.key     = this.keys[this.index1++];
			this.current = this.val = this._[this.key];

			return this;
		},
		stop    : function Iter_stop() {
			this.stopped = true;
			return this;
		}
	};

	util.defs( Iter.prototype, { // todo: these aren't tested yet!
		first     : { get : function() { return this._[this.keys[this.firstKey]]; } },
		last      : { get : function() { return this._[this.keys[this.lastKey]];  } },
		next      : { get : function() { return this._[this.keys[this.nextKey]];  } },
		prev      : { get : function() { return this._[this.keys[this.prevKey]];  } },

		nextIndex : { get : function() {
			var i = this.index + 1;
			return i <= this.lastIndex  ? i : U;
		} },
		prevIndex : { get : function() {
			var i = this.index - 1;
			return i >= this.firstIndex ? i : U;
		} },

		firstKey  : { get : function() { return this.keys[this.firstIndex]; } },
		lastKey   : { get : function() { return this.keys[this.lastIndex];  } },
		nextKey   : { get : function() { return this.keys[this.nextIndex];  } },
		prevKey   : { get : function() { return this.keys[this.prevIndex];  } }
	}, 'r' );

/*** END:   Classes used by compiled templates ***/

/*** START: create template methods ***/

	function aggregatetNonEmpty( res, str ) {
		util.empty( str ) || res.push( str );
		return res;
	}

	function aggregateStatement( ctx, s ) {
		return s.reduce( function( res, v, i, parts ) {
			if ( i == 0 ) return wrapGetter( ctx, v );
			var args = '', fn, j = v.indexOf( ':' );
			if ( !!~j ) {
				fn   = v.substring( 0,  j );
				args = v.substring( j + 1 );
			}
			else fn = v;
			!args || ( args = ', ' + args.split( ',' ).map( function( o ) { return wrapGetter( this, o ); }, ctx ).join( ', ' ) );
			return util.format( tpl_statement, getFnParent( fn ), fn, wrapGetter( ctx, res ), args, fn_var.ctx );
		}, '' );
	}

	function assembleParts( ctx, parts ) {
		var fn = [fn_start], part;

		while ( part = parts.shift() ) fn.push( emitTag( ctx, part, parts ) );

		fn.push( fn_end );

		return fn.join( '\r\n' );
	}

	function clean( str ) { return str.replace( re_format_delim, '' ).replace( re_new_line, '\n' ).replace( re_space, ' ' ).trim(); }

	function compileTemplate( ctx, fn ) {
		fn = util.format( tpl_compiled, '*', ctx.__tpl__.replace( re_fix_jscomments, '$1 \\$2' ), fn, ctx.sourceURL ? ctx.sourceURL : util.format( tpl_srcurl, ctx.id ) );

		var func = ( new Function( 'root', 'ContextStack', 'Iter', fn_var.filter, fn_var.assert, fn_var.util, fn_var.ctx, fn ) );

		return func.bind( ctx, util.global, ContextStack, Iter, util.copy( ctx.filters, __Class__.Filter.all(), true ), ba, bu );
	}

	function createTemplate( ctx ) {
		ctx.currentIterKeys = [];
		var fn = compileTemplate( ctx, assembleParts( ctx, splitStr( ctx.__tpl__ ) ) );
		delete ctx.currentIterKeys;
		return fn;
	}

	function emitTag( ctx, part, parts ) {
		var tag;
		if ( tag = __Class__.Tag.get( part ) ) {
			part = parts.shift();
			return tag.emit( internals, ctx, part, parts );
		}
		return wrapStr( util.format( '"{0}"', part.replace( re_esc, "\\$1" ) ) );
	}

 	function formatStatement( ctx, str ) {
		str = clean( str );
		switch ( str ) {
			case 'AND' : return ' && ';
			case 'OR'  : return ' || ';
		}
		return contains( str, '|' ) || contains( str, delim ) ? ( ' ' + str + delim ).replace( re_statement_split, function( m ) {
			return ba.blank( m ) || m == delim ? '' : aggregateStatement( ctx, clean( m ).split( '|' ) );
		} ) : wrapGetter( ctx, str );
	}

	function getFnParent( fn ) { return ( ba[fn] ? fn_var.assert : bu[fn] ? fn_var.util : fn_var.filter ); }

	function splitStr( str ) {
		return str.replace( re_split_tpl, split_replace )
				  .split( split_token )
				  .reduce( aggregatetNonEmpty, [] );
	}

	function stringify( o, str ) {
		switch ( typeof o ) {
			case 'boolean' : case 'number' : case 'string' : return String( o );
			default        : switch ( util.ntype( o ) ) {
				case 'date'   : return o.toDateString();
				case 'array'  : return mapc( o, stringify ).join( ', ' );
				case 'object' : return cache_key in o
							  ? stringify( o.dict ) : ( ( str = o.toString() ) != '[object Object]' )
							  ? str : mapc( Object.values( o ), stringify ).join( ', ' );
				default       : switch ( util.type( o ) ) {
					case 'htmlelement'    : return o.outerHTML; //o.textContent || o.text || o.innerText;
					case 'htmlcollection' : return mapc( Array.coerce( o ), function( el ) { return stringify( el ); } ).join( '\n' );
				}
			}
		}
		return '';
	}

	function usingIterKey( key ) { return this == key || ba.startsWith( this, key + '.' ); }
	function usingIterKeys( keys, o ) { return keys.length ? keys.some( function( k ) { return k.some( usingIterKey, o ); } ) : 0; }

	function wrapGetter( ctx, o ) {
		var k = ctx.currentIterKeys || []; o = clean( o );
		return ( contains( o, '.call(' )
			|| re_special_char.test( o )
			|| ( ba.startsWith( o, '"' ) && ba.endsWith( o, '"' ) )
			|| ( ba.startsWith( o, "'" ) && ba.endsWith( o, "'" ) )
			|| !isNaN( o ) )
		? o : ( ba.startsWith( o, '$_.' ) || ba.startsWith( o, 'iter.' ) || ( k.length && usingIterKeys( k, o ) ) || o in RESERVED )
		? o.replace( re_statement_fix, re_statement_replacer ) : util.format( '$C.get( "{0}" )', o );
	}

	function wrapStr( str ) { return util.format( '{0} += {1};', fn_var.output, str.replace( re_br, '\\n' ) ); }

// these will be passed to tags & statements for internal usage
	internals = {
		assembleparts   : assembleParts,   clean   : clean,      compiletpl : compileTemplate,
		createtpl       : createTemplate,  emittag : emitTag,    fnvar      : fn_var,
		formatstatement : formatStatement, get     : wrapGetter, util       : bu,
		wrap            : wrapStr
	};
/*** END:   create template methods ***/

/*** START: Templ8 constructor and prototype ***/
	function __Class__() {
		var a = Array.coerce( arguments ),
			f = is_obj( a[a.length - 1] ) ? a.pop() : is_obj( a[0] ) ? a.shift() : null,
			fb;

// take care of peeps who are too lazy or too ©ººL to use the "new" constructor...
		if ( !( this instanceof __Class__ ) )
			return is_obj( f ) ? new __Class__( a.join( '' ), f ) : new __Class__( a.join( '' ) );

		!f || defaults.forEach( function( k ) {
			if ( k in f ) { this[k] = f[k]; delete f[k]; }
		}, this );

		fb = this.fallback;
		if ( ( !fb && this.debug ) || ( typeof fb == 'string' && fb.toUpperCase() === DEBUG ) )
			this.fallback = DEBUG;

		this.filters = f || {};

		this.__tpl__ = a.join( '\n' );

		tpl[$id( this )] = this;

		if ( this.compiled ) {
			this.compiled = false;
			compile( this );
		}
	}

	function $id( ctx ) {
		ctx.id || ( ctx.id = util.format( tpl_id, ++id_count ) );
		return ctx.id;
	}

	function parse( dict ) {
		this.compiled || compile( this );
		this[fn_var.dict] = dict;
		var s = this._parse( dict );
		delete this[fn_var.dict];
		return s;
	}

	function compile( ctx ) {
		if ( !ctx.compiled ) {
			ctx.compiled = true;
			ctx._parse   = createTemplate( ctx );
		}
		return ctx;
	}

	__Class__.prototype = {
		compiled : false, debug : false, dict : null, fallback : '',
		parse    : parse
	};
/*** END:   Templ8 constructor and prototype ***/

/*** START: Templ8 functionality packages ***/
// exposed for general usage
	util.defs( __Class__, {             // store a reference to m8 in Templ8 so we can do fun stuff in commonjs
		m8       : { value : util }, // modules without having to re-request m8 as well as Templ8 each time.
		escapeRE : escapeRE,  format    : util.format,  get : getTPL,
		gsub     : util.gsub, stringify : stringify
	}, 'r' );

	function Mgr( o ) {
		var cache = {};

		!is_obj( o ) || util.copy( cache, o );

		function _add( id, fn, replace ) { ( !replace && id in cache ) || ( cache[id] = fn ); }
		function  add( replace, o ) {
			switch( typeof o ) {
				case 'string' : _add( o, arguments[2], replace );            break;
				case 'object' : for ( var k in o ) _add( k, o[k], replace ); break;
			} return this;
		}

		this.all     = function()     { return util.copy( cache ); };
		this.add     = function()     { return add.call( this, false, arguments[0], arguments[1] ); };
		this.get     = function( id ) { return cache[id]; };
		this.replace = function()     { return add.call( this, true, arguments[0], arguments[1] ); };
	}

	__Class__.Assert    = new Mgr( ba );
	__Class__.Filter    = new Mgr( bf );
	__Class__.Statement = new Mgr;
	__Class__.Tag       = new function() {
		var KEYS   = 'emit end start'.split( ' ' ),
			ERRORS = {
				emit  : 'emit function',
				end   : 'end tag definition',
				start : 'start tag definition'
			},
			tag    = {};

		function Tag( config ) {
			KEYS.forEach( assert_exists, config );
			util.copy( this, config );
			tag[this.start] = this;
		}

		function assert_exists( k ) { if ( !( k in this ) ) { throw new TypeError( util.format( 'A ' + Name + ' Tag requires an {0}', ERRORS[k] ) ); } }

		this.all = function() { return util.copy( tag ); };

		this.compileRegExp = function() {
			var end = [], start = [], t;
			for ( t in tag ) {
				end.push( escapeRE( tag[t].end.substring( 0, 1 ) ) );
				start.push( escapeRE( tag[t].start.substring( 1 ) ) );
			}
			return ( re_split_tpl = new RegExp( '(\\{[' + start.join( '' ) + '])\\s*(.+?)\\s*([' + end.join( '' ) + ']\\})', 'gm' ) );
		};

		this.create = function( o, dont_compile ) {
			new Tag( o ); dont_compile === true || this.compileRegExp();
			return this;
		};

		this.get = function( id ) { return tag[id]; };
	};

/*** END:   Templ8 functionality packages ***/
